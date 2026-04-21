"""Execution service with simulated slippage and latency."""
import asyncio
import random
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.models.order import Order, OrderSide, OrderStatus, OrderType, TradeFill
from app.providers.registry import ProviderRegistry
from app.providers.schemas import AssetPrice


class ExecutionService:
    """Handles order execution with simulated market conditions."""

    # INR to USD exchange rate (will be fetched live in future)
    INR_USD_RATE = Decimal("83.0")

    def __init__(
        self,
        provider_registry: Optional[ProviderRegistry] = None,
    ):
        """Initialize execution service.

        Args:
            provider_registry: Registry for fetching prices. If None, uses default.
        """
        self.provider_registry = provider_registry
        self._provider = None

    async def _get_provider(self) -> ProviderRegistry:
        """Get or create provider registry."""
        if self.provider_registry is None:
            from app.providers.registry import ProviderRegistry

            self.provider_registry = ProviderRegistry.create_default()
        return self.provider_registry

    async def _calculate_execution_latency(self) -> int:
        """Simulate execution latency 50-500ms."""
        # Return random integer between 50 and 500
        return random.randint(50, 500)

    async def _calculate_slippage(self, order_type: OrderType) -> Decimal:
        """Calculate slippage based on order type.

        - Market orders: 0.01-0.1%
        - Limit/stop orders: 0.005-0.05%
        """
        if order_type == OrderType.MARKET:
            # 0.01% to 0.10%
            slippage_bps = random.randint(1, 10)
        else:
            # 0.005% to 0.05%
            slippage_bps = random.randint(1, 5) / 2

        # Convert basis points to decimal (e.g., 5 bps = 0.0005)
        return Decimal(str(slippage_bps / 10000)).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

    def _apply_slippage(
        self,
        price: Decimal,
        slippage: Decimal,
        side: OrderSide,
    ) -> Decimal:
        """Apply slippage to price.

        For buys: price increases (worse for buyer)
        For sells: price decreases (worse for seller)

        Returns:
            Adjusted price after slippage
        """
        if side == OrderSide.BUY:
            # Buy at higher price
            adjusted = price * (Decimal("1") + slippage)
        else:
            # Sell at lower price
            adjusted = price * (Decimal("1") - slippage)

        return adjusted.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)

    async def fill_market_order(
        self,
        order: Order,
        match_next_fill_sequence: int = 1,
    ) -> TradeFill:
        """Execute a market order fill.

        Args:
            order: The order to fill
            match_next_fill_sequence: Sequence number for partial fills

        Returns:
            TradeFill record
        """
        # Simulate execution delay
        latency_ms = await self._calculate_execution_latency()
        await asyncio.sleep(latency_ms / 1000)

        # Fetch current price
        provider = await self._get_provider()
        asset_price = await provider.fetch_price(order.symbol)
        base_price = Decimal(str(asset_price.price))

        # Calculate slippage
        slippage = await self._calculate_slippage(OrderType.MARKET)

        # Apply slippage to get execution price
        execution_price = self._apply_slippage(
            base_price,
            slippage,
            order.side,
        )

        # Handle partial fills
        fill_qty = order.remaining_quantity

        # Create fill record
        fill = TradeFill(
            order_id=order.id,
            fill_sequence=match_next_fill_sequence,
            symbol=order.symbol,
            quantity=fill_qty,
            price=execution_price,
            currency=order.currency,
            slippage_pct=slippage,
            execution_latency_ms=latency_ms,
        )

        # Update order
        order.filled_quantity += fill_qty
        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = fill.filled_at
        else:
            order.status = OrderStatus.PARTIAL_FILLED

        return fill

    async def fill_limit_order(
        self,
        order: Order,
        current_price: Decimal,
        match_next_fill_sequence: int = 1,
    ) -> Optional[TradeFill]:
        """Execute a limit order if conditions are met.

        Args:
            order: The limit order
            current_price: Current market price
            match_next_fill_sequence: Sequence number for partial fills

        Returns:
            TradeFill if order fills, None otherwise
        """
        if order.price is None:
            raise ValueError("Limit order must have a price")

        # Check if limit condition is met
        # For BUY limit: current_price <= limit_price (buy when cheap)
        # For SELL limit: current_price >= limit_price (sell when expensive)
        should_fill = False
        if order.side == OrderSide.BUY:
            should_fill = current_price <= order.price
        else:  # SELL
            should_fill = current_price >= order.price

        if not should_fill:
            return None

        # Simulate execution delay (less than market orders)
        latency_ms = await self._calculate_execution_latency()
        await asyncio.sleep(latency_ms / 1000)

        # Calculate slippage (less than market)
        slippage = await self._calculate_slippage(OrderType.LIMIT)

        # For limit orders executing at or better than limit
        # Fill at the more favorable of: limit price or (slippage-adjusted current)
        execution_price = self._apply_slippage(current_price, slippage, order.side)

        # Ensure we don't exceed limit for buys
        if order.side == OrderSide.BUY:
            execution_price = min(execution_price, order.price)
        else:
            execution_price = max(execution_price, order.price)

        # Handle partial fills
        fill_qty = order.remaining_quantity

        # Create fill record
        fill = TradeFill(
            order_id=order.id,
            fill_sequence=match_next_fill_sequence,
            symbol=order.symbol,
            quantity=fill_qty,
            price=execution_price,
            currency=order.currency,
            slippage_pct=slippage,
            execution_latency_ms=latency_ms,
        )

        # Update order
        order.filled_quantity += fill_qty
        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = fill.filled_at
        else:
            order.status = OrderStatus.PARTIAL_FILLED

        return fill

    def check_stop_trigger(
        self,
        order: Order,
        current_price: Decimal,
    ) -> bool:
        """Check if stop order trigger condition is met.

        Stop-loss:
        - BUY: triggers when current >= stop_price (trying to cover short)
        - SELL: triggers when current <= stop_price (exit long position)

        Take-profit:
        - BUY: triggers when current <= stop_price? No, typically...
        - Actually for take-profit BUY: you want price to go DOWN to buy
          For take-profit SELL: you want price to go UP to sell

        Args:
            order: The stop/take-profit order
            current_price: Current market price

        Returns:
            True if trigger condition is met (order should execute)
        """
        if order.stop_price is None:
            raise ValueError("Stop order must have stop_price")

        if order.order_type == OrderType.STOP_LOSS:
            if order.side == OrderSide.BUY:
                # Stop-loss buy: triggers on upward move (cover short)
                return current_price >= order.stop_price
            else:  # SELL
                # Stop-loss sell: triggers on downward move (exit long)
                return current_price <= order.stop_price

        elif order.order_type == OrderType.TAKE_PROFIT:
            if order.side == OrderSide.BUY:
                # Take-profit buy: triggers when price drops to target
                return current_price <= order.stop_price
            else:  # SELL
                # Take-profit sell: triggers when price rises to target
                return current_price >= order.stop_price

        return False

    async def fill_stop_order(
        self,
        order: Order,
        triggered_price: Decimal,
        match_next_fill_sequence: int = 1,
    ) -> TradeFill:
        """Execute a stop order that has been triggered.

        Stop orders execute at market-like conditions once triggered.

        Args:
            order: The triggered stop order
            triggered_price: Price that triggered the order
            match_next_fill_sequence: Sequence number for partial fills

        Returns:
            TradeFill record
        """
        # Simulate execution delay
        latency_ms = await self._calculate_execution_latency()
        await asyncio.sleep(latency_ms / 1000)

        # Calculate slippage (market-like for triggered stops)
        slippage = await self._calculate_slippage(order.order_type)

        # Apply slippage from trigger price
        execution_price = self._apply_slippage(
            triggered_price,
            slippage,
            order.side,
        )

        # Handle partial fills
        fill_qty = order.remaining_quantity

        # Create fill record
        fill = TradeFill(
            order_id=order.id,
            fill_sequence=match_next_fill_sequence,
            symbol=order.symbol,
            quantity=fill_qty,
            price=execution_price,
            currency=order.currency,
            slippage_pct=slippage,
            execution_latency_ms=latency_ms,
        )

        # Update order
        order.filled_quantity += fill_qty
        if order.filled_quantity >= order.quantity:
            order.status = OrderStatus.FILLED
            order.filled_at = fill.filled_at
        else:
            order.status = OrderStatus.PARTIAL_FILLED

        return fill

    async def get_current_price(self, symbol: str) -> Decimal:
        """Get current price for a symbol.

        Args:
            symbol: Asset symbol

        Returns:
            Current price as Decimal
        """
        provider = await self._get_provider()
        asset_price = await provider.fetch_price(symbol)
        return Decimal(str(asset_price.price))
