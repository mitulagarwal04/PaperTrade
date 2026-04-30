"""Order service for placing and managing orders."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderSide, OrderStatus, OrderType, TradeFill
from app.models.portfolio import UserCash
from app.services.execution_service import ExecutionService
from app.services.portfolio_service import PortfolioService


class OrderService:
    """Service for order placement, cancellation, and management."""

    # INR to USD exchange rate (use live rate in future)
    INR_USD_RATE = Decimal("83.0")

    def __init__(
        self,
        db_session: AsyncSession,
        execution_service: Optional[ExecutionService] = None,
        portfolio_service: Optional[PortfolioService] = None,
    ):
        """Initialize order service.

        Args:
            db_session: Database session
            execution_service: Execution service for fills. If None, creates default.
            portfolio_service: Portfolio service for lot tracking. If None, creates default.
        """
        self.db = db_session
        self.execution_service = execution_service or ExecutionService()
        self.portfolio_service = portfolio_service or PortfolioService(db_session)

    def _calculate_order_value_inr(
        self,
        quantity: Decimal,
        price: Decimal,
        currency: str = "USD",
    ) -> Decimal:
        """Calculate order value in INR."""
        value_in_currency = quantity * price
        # Convert to INR (USD -> INR)
        value_inr = value_in_currency * self.INR_USD_RATE
        return value_inr.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def _get_user_cash(self) -> UserCash:
        """Get or create user cash record."""
        result = await self.db.execute(select(UserCash).limit(1))
        cash = result.scalar_one_or_none()
        if cash is None:
            cash = UserCash()
            self.db.add(cash)
            await self.db.flush()
        return cash

    async def _validate_and_reserve_cash(
        self,
        side: OrderSide,
        quantity: Decimal,
        price: Decimal,
        currency: str = "USD",
    ) -> Decimal:
        """Validate sufficient cash and reserve if valid.

        Args:
            side: BUY or SELL
            quantity: Amount
            price: Price per unit
            currency: Currency code

        Returns:
            Reserved amount in INR

        Raises:
            ValueError: If insufficient cash for BUY order
        """
        cash = await self._get_user_cash()

        if side == OrderSide.SELL:
            # SELL orders don't reserve cash (they sell existing holdings)
            return Decimal("0.00")

        # Calculate value in INR
        order_value = self._calculate_order_value_inr(quantity, price, currency)

        # Check available cash
        if order_value > cash.available_inr:
            raise ValueError(
                f"Insufficient available cash: need {order_value} INR, "
                f"have {cash.available_inr} INR"
            )

        # Reserve cash (don't flush here - outer transaction handles commits)
        cash.reserve(order_value)

        return order_value

    async def place_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: Decimal,
        price: Optional[Decimal] = None,
        stop_price: Optional[Decimal] = None,
    ) -> Order:
        """Place a new order.

        Args:
            symbol: Asset symbol
            side: BUY or SELL
            order_type: MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
            quantity: Amount to trade
            price: Limit price (required for LIMIT, optional for others)
            stop_price: Trigger price (required for STOP_LOSS, TAKE_PROFIT)

        Returns:
            Created Order

        Raises:
            ValueError: If order parameters are invalid or insufficient cash
        """
        # Validate inputs
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        if order_type == OrderType.LIMIT and price is None:
            raise ValueError("Limit order requires price")

        if order_type in (OrderType.STOP_LOSS, OrderType.TAKE_PROFIT) and stop_price is None:
            raise ValueError(f"{order_type} order requires stop_price")

        # Get current price for cash calculation (and market orders)
        current_price = await self.execution_service.get_current_price(symbol)

        # Calculate price for cash reservation
        if order_type == OrderType.MARKET:
            reservation_price = current_price
        elif order_type == OrderType.LIMIT:
            reservation_price = price
        else:
            # For stop orders, use stop price for reservation
            reservation_price = stop_price or current_price

        # Reserve cash if BUY
        reserved_inr = Decimal("0.00")
        if side == OrderSide.BUY:
            reserved_inr = await self._validate_and_reserve_cash(
                side,
                quantity,
                reservation_price,
            )

        # Create order
        order = Order(
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_price=stop_price,
            status=OrderStatus.OPEN,  # Open for fill monitoring
            currency="USD",  # Assumed for now
            reserved_inr=reserved_inr,
        )

        self.db.add(order)
        await self.db.flush()  # Get order ID

        # Process immediate fills
        if order_type == OrderType.MARKET:
            # Execute immediately
            fill = await self.execution_service.fill_market_order(order)
            self.db.add(fill)

            # Update cash: deduct reserved, add proceeds if SELL
            cash = await self._get_user_cash()
            if side == OrderSide.BUY:
                # Deduct total cost
                fill_value_inr = self._calculate_order_value_inr(
                    fill.quantity, fill.price
                )
                cash.release_reservation(reserved_inr)
                cash.deduct_cash(fill_value_inr)
            else:  # SELL
                # Add proceeds (no reservation to release)
                proceeds_inr = self._calculate_order_value_inr(
                    fill.quantity, fill.price
                )
                cash.add_cash(proceeds_inr)

            await self.db.flush()

            # Create portfolio lot
            await self.portfolio_service.process_fill(fill, side)

        elif order_type == OrderType.LIMIT:
            # Check if limit condition met immediately
            fill = await self.execution_service.fill_limit_order(
                order, current_price
            )
            if fill:
                self.db.add(fill)

                # Update cash
                cash = await self._get_user_cash()
                if side == OrderSide.BUY:
                    fill_value_inr = self._calculate_order_value_inr(
                        fill.quantity, fill.price
                    )
                    cash.release_reservation(reserved_inr)
                    cash.deduct_cash(fill_value_inr)

                await self.db.flush()

                # Create portfolio lot
                await self.portfolio_service.process_fill(fill, side)

        # STOP orders remain OPEN until trigger condition is met

        await self.db.commit()

        # Eagerly load fills for response
        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.fills))
            .where(Order.id == order.id)
        )
        order = result.scalar_one()
        return order

    async def cancel_order(
        self,
        order_id: int,
        reason: str = "user",
    ) -> Order:
        """Cancel an open order.

        Args:
            order_id: Order ID to cancel
            reason: Cancellation reason

        Returns:
            Updated Order

        Raises:
            ValueError: If order not found or not cancellable
        """
        # Fetch order
        result = await self.db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()

        if order is None:
            raise ValueError(f"Order {order_id} not found")

        # Check if cancellable
        if order.status not in (OrderStatus.OPEN, OrderStatus.PARTIAL_FILLED):
            raise ValueError(
                f"Cannot cancel order with status {order.status}"
            )

        # Release reserved cash if BUY
        if order.side == OrderSide.BUY and order.reserved_inr > 0:
            cash = await self._get_user_cash()
            cash.release_reservation(order.reserved_inr)

        # Update order status
        order.status = OrderStatus.CANCELLED
        from datetime import datetime
        order.cancelled_at = datetime.utcnow()
        order.cancel_reason = reason

        await self.db.commit()

        # Eagerly load fills for response
        result = await self.db.execute(
            select(Order)
            .options(selectinload(Order.fills))
            .where(Order.id == order.id)
        )
        return result.scalar_one()

    async def get_order(
        self,
        order_id: int,
        include_fills: bool = True,
    ) -> Optional[Order]:
        """Get order by ID.

        Args:
            order_id: Order ID
            include_fills: Whether to load fills

        Returns:
            Order or None
        """
        if include_fills:
            result = await self.db.execute(
                select(Order)
                .where(Order.id == order_id)
                .options(selectinload(Order.fills))
            )
        else:
            result = await self.db.execute(
                select(Order).where(Order.id == order_id)
            )

        return result.scalar_one_or_none()

    async def list_orders(
        self,
        status: Optional[OrderStatus] = None,
        limit: int = 100,
    ) -> List[Order]:
        """List orders with optional status filter.

        Args:
            status: Filter by status
            limit: Maximum results

        Returns:
            List of orders
        """
        query = select(Order).order_by(desc(Order.created_at))

        if status:
            query = query.where(Order.status == status)

        query = query.limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_open_orders(self) -> List[Order]:
        """Get all open and partial-filled orders.

        Returns:
            List of active orders
        """
        query = (
            select(Order)
            .where(
                Order.status.in_([
                    OrderStatus.OPEN,
                    OrderStatus.PARTIAL_FILLED,
                ])
            )
            .order_by(Order.created_at)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def check_and_fill_pending_orders(self) -> List[TradeFill]:
        """Check open limit/stop orders and fill if conditions met.

        Called by background monitor to process conditional orders.

        Returns:
            List of new fills created
        """
        fills: List[TradeFill] = []

        # Get open conditional orders
        open_orders = await self.get_open_orders()
        conditional_orders = [
            o for o in open_orders
            if o.order_type in (OrderType.LIMIT, OrderType.STOP_LOSS, OrderType.TAKE_PROFIT)
        ]

        for order in conditional_orders:
            # Get current price
            current_price = await self.execution_service.get_current_price(
                order.symbol
            )

            fill: Optional[TradeFill] = None

            if order.order_type == OrderType.LIMIT:
                # Check limit fill condition
                fill = await self.execution_service.fill_limit_order(
                    order, current_price
                )

            elif order.order_type in (OrderType.STOP_LOSS, OrderType.TAKE_PROFIT):
                # Check trigger
                triggered = self.execution_service.check_stop_trigger(
                    order, current_price
                )
                if triggered:
                    fill = await self.execution_service.fill_stop_order(
                        order, current_price
                    )

            if fill:
                self.db.add(fill)
                fills.append(fill)

                # Update cash if BUY
                if order.side == OrderSide.BUY:
                    cash = await self._get_user_cash()
                    fill_value_inr = self._calculate_order_value_inr(
                        fill.quantity, fill.price
                    )
                    cash.release_reservation(order.reserved_inr)
                    cash.deduct_cash(fill_value_inr)

                # Create portfolio lot / consume FIFO lots
                await self.portfolio_service.process_fill(fill, order.side)

        if fills:
            await self.db.commit()

        return fills
