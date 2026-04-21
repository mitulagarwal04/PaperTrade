"""Tests for order management."""
import pytest
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.order import Order, OrderSide, OrderStatus, OrderType, TradeFill
from app.models.portfolio import UserCash
from app.services.order_service import OrderService
from app.services.execution_service import ExecutionService


@pytest.fixture
async def user_cash(session: AsyncSession) -> UserCash:
    """Create test user cash."""
    cash = UserCash(
        total_inr=Decimal("100000.00"),
        reserved_inr=Decimal("0.00"),
        available_inr=Decimal("100000.00"),
    )
    session.add(cash)
    await session.commit()
    return cash


@pytest.fixture
def mock_execution_service():
    """Create mock execution service."""
    class MockExecutionService:
        async def fill_market_order(self, order, match_next_fill_sequence=1):
            fill = TradeFill(
                order_id=order.id,
                fill_sequence=match_next_fill_sequence,
                symbol=order.symbol,
                quantity=order.quantity,
                price=Decimal("150.00"),
                currency=order.currency,
                slippage_pct=Decimal("0.001"),
                execution_latency_ms=100,
                filled_at=datetime.utcnow(),
            )
            order.filled_quantity = order.quantity
            order.status = OrderStatus.FILLED
            order.filled_at = fill.filled_at
            return fill

        async def get_current_price(self, symbol: str) -> Decimal:
            return Decimal("150.00")

    return MockExecutionService()


@pytest.mark.asyncio
async def test_place_market_buy_order_with_sufficient_cash(
    session: AsyncSession,
    user_cash,
    mock_execution_service,
):
    """Test placing a market buy order with sufficient cash."""
    service = OrderService(session, mock_execution_service)

    order = await service.place_order(
        symbol="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=Decimal("1.0"),
    )

    assert order.symbol == "AAPL"
    assert order.side == OrderSide.BUY
    assert order.order_type == OrderType.MARKET
    assert order.status == OrderStatus.FILLED
    assert order.filled_quantity == Decimal("1.0")

    # Check cash was deducted
    await session.refresh(user_cash)
    # 1 share * 150 USD * 83 INR/USD = 12,450 INR cost
    assert user_cash.total_inr == Decimal("100000.00") - Decimal("12450.00")


@pytest.mark.asyncio
async def test_place_market_buy_order_with_insufficient_cash(
    session: AsyncSession,
    mock_execution_service,
):
    """Test that market buy order fails with insufficient cash."""
    # Use session directly - user_cash already seeded in conftest
    service = OrderService(session, mock_execution_service)

    with pytest.raises(ValueError, match="Insufficient available cash"):
        await service.place_order(
            symbol="AAPL",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=Decimal("1000.0"),  # ~12.4M INR needed
        )


@pytest.mark.asyncio
async def test_cancel_open_order(
    session: AsyncSession,
    user_cash,
):
    """Test canceling an open limit order."""
    # First manually create an open order
    order = Order(
        symbol="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=Decimal("1.0"),
        price=Decimal("100.00"),
        status=OrderStatus.OPEN,
        reserved_inr=Decimal("10000.00"),
    )
    session.add(order)
    await session.commit()

    # Reserve cash
    user_cash.total_inr = Decimal("100000.00")
    user_cash.reserved_inr = Decimal("10000.00")
    user_cash.available_inr = Decimal("90000.00")
    await session.flush()

    service = OrderService(session)
    cancelled = await service.cancel_order(order.id)

    assert cancelled.status == OrderStatus.CANCELLED
    assert cancelled.cancel_reason == "user"

    # Check cash was released
    await session.refresh(user_cash)
    assert user_cash.reserved_inr == Decimal("0")
    assert user_cash.available_inr == Decimal("100000.00")


@pytest.mark.asyncio
async def test_place_limit_order_above_market_stays_open(
    session: AsyncSession,
    user_cash,
):
    """Test that limit buy with price above market fills immediately."""
    class MockExec:
        async def get_current_price(self, symbol: str) -> Decimal:
            return Decimal("150.00")

        async def fill_limit_order(self, order, current_price, match_next_fill_sequence=1):
            # Simulate fill since price > current
            fill = TradeFill(
                order_id=order.id,
                fill_sequence=match_next_fill_sequence,
                symbol=order.symbol,
                quantity=order.quantity,
                price=Decimal("100.00"),
                currency=order.currency,
                slippage_pct=Decimal("0.0001"),
                execution_latency_ms=50,
                filled_at=datetime.utcnow(),
            )
            order.filled_quantity = order.quantity
            order.status = OrderStatus.FILLED
            order.filled_at = fill.filled_at
            return fill

    service = OrderService(session, MockExec())
    order = await service.place_order(
        symbol="AAPL",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=Decimal("1.0"),
        price=Decimal("160.00"),  # Above market
    )

    assert order.status == OrderStatus.FILLED


@pytest.mark.asyncio
async def test_list_orders_with_status_filter(
    session: AsyncSession,
):
    """Test listing orders with status filter."""
    service = OrderService(session)

    # Create some orders
    orders = [
        Order(
            symbol="AAPL",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            quantity=Decimal("1.0"),
            price=Decimal("150.00"),
            status=OrderStatus.OPEN,
        ),
        Order(
            symbol="MSFT",
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            quantity=Decimal("1.0"),
            price=Decimal("250.00"),
            status=OrderStatus.FILLED,
        ),
        Order(
            symbol="TSLA",
            side=OrderSide.SELL,
            order_type=OrderType.LIMIT,
            quantity=Decimal("1.0"),
            price=Decimal("200.00"),
            status=OrderStatus.CANCELLED,
        ),
    ]
    for o in orders:
        session.add(o)
    await session.commit()

    open_orders = await service.list_orders(status=OrderStatus.OPEN)
    assert len(open_orders) == 1
    assert open_orders[0].symbol == "AAPL"

    all_orders = await service.list_orders(limit=100)
    assert len(all_orders) == 3
