"""Orders API routes."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.order import Order, OrderSide, OrderStatus, OrderType, TradeFill
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


# Pydantic Schemas
class OrderCreateRequest(BaseModel):
    """Request to create a new order."""
    symbol: str = Field(..., min_length=1, max_length=20)
    side: OrderSide
    order_type: OrderType
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = Field(None, gt=0)
    stop_price: Optional[Decimal] = Field(None, gt=0)

    @field_validator("symbol")
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        return v.upper()


class FillResponse(BaseModel):
    """Trade fill response."""
    id: int
    quantity: Decimal
    price: Decimal
    currency: str
    slippage_pct: Decimal
    execution_latency_ms: int
    filled_at: datetime


class OrderResponse(BaseModel):
    """Order response."""
    id: int
    symbol: str
    side: str
    order_type: str
    quantity: Decimal
    filled_quantity: Decimal
    price: Optional[Decimal]
    stop_price: Optional[Decimal]
    status: str
    currency: str
    reserved_inr: Decimal
    created_at: datetime
    updated_at: datetime
    filled_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]
    fills: List[FillResponse] = []


class CancelOrderRequest(BaseModel):
    """Request to cancel an order."""
    reason: Optional[str] = "user"


class OrderListParams(BaseModel):
    """Query parameters for order listing."""
    status: Optional[OrderStatus] = None
    limit: int = Field(100, ge=1, le=1000)


class OpenOrdersResponse(BaseModel):
    """Open orders response."""
    orders: List[OrderResponse]
    count: int


def to_order_response(order: Order, include_fills: bool = True) -> OrderResponse:
    """Convert Order model to response schema."""
    fills = []
    if include_fills and hasattr(order, "fills"):
        fills = [
            FillResponse(
                id=f.id,
                quantity=f.quantity,
                price=f.price,
                currency=f.currency,
                slippage_pct=f.slippage_pct,
                execution_latency_ms=f.execution_latency_ms,
                filled_at=f.filled_at,
            )
            for f in order.fills
        ]

    return OrderResponse(
        id=order.id,
        symbol=order.symbol,
        side=order.side.value,
        order_type=order.order_type.value,
        quantity=order.quantity,
        filled_quantity=order.filled_quantity,
        price=order.price,
        stop_price=order.stop_price,
        status=order.status.value,
        currency=order.currency,
        reserved_inr=order.reserved_inr,
        created_at=order.created_at,
        updated_at=order.updated_at,
        filled_at=order.filled_at,
        cancelled_at=order.cancelled_at,
        cancel_reason=order.cancel_reason,
        fills=fills,
    )


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place a new order",
)
async def place_order(
    request: OrderCreateRequest,
    session: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Place a new trading order.

    Creates a market, limit, stop-loss, or take-profit order.
    BUY orders require sufficient available cash.
    """
    service = OrderService(session)

    try:
        order = await service.place_order(
            symbol=request.symbol,
            side=request.side,
            order_type=request.order_type,
            quantity=request.quantity,
            price=request.price,
            stop_price=request.stop_price,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return to_order_response(order)


@router.get(
    "",
    response_model=List[OrderResponse],
    summary="List orders",
)
async def list_orders(
    status: Optional[OrderStatus] = None,
    limit: int = 100,
    session: AsyncSession = Depends(get_db),
) -> List[OrderResponse]:
    """List orders with optional status filter.

    Returns orders in descending chronological order.
    """
    service = OrderService(session)
    orders = await service.list_orders(status=status, limit=limit)
    return [to_order_response(o) for o in orders]


@router.get(
    "/open",
    response_model=OpenOrdersResponse,
    summary="Get open orders",
)
async def get_open_orders(
    session: AsyncSession = Depends(get_db),
) -> OpenOrdersResponse:
    """Get all open and partial-filled orders."""
    service = OrderService(session)
    orders = await service.get_open_orders()
    return OpenOrdersResponse(
        orders=[to_order_response(o) for o in orders],
        count=len(orders),
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get order details",
)
async def get_order(
    order_id: int,
    session: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Get order details including fills."""
    service = OrderService(session)
    order = await service.get_order(order_id, include_fills=True)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    return to_order_response(order)


@router.delete(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Cancel an order",
)
async def cancel_order(
    order_id: int,
    request: Optional[CancelOrderRequest] = None,
    session: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Cancel an open or partial-filled order.

    Releases any reserved cash for BUY orders.
    """
    service = OrderService(session)

    try:
        order = await service.cancel_order(
            order_id=order_id,
            reason=request.reason if request else "user",
        )
    except ValueError as e:
        # Check if not found or not cancellable
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    return to_order_response(order)
