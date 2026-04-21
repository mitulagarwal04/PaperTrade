"""Portfolio API routes."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.order import OrderSide
from app.services.portfolio_service import PortfolioService, Position, PortfolioSummary
from app.tasks.order_monitor import get_order_monitor, reset_order_monitor

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# Pydantic Schemas
class PositionResponse(BaseModel):
    """Position response."""
    symbol: str
    quantity: Decimal
    avg_cost_inr: Decimal
    total_cost_inr: Decimal
    current_price: Decimal
    current_price_inr: Decimal
    market_value_inr: Decimal
    unrealized_pnl_inr: Decimal
    currency: str


class TradeHistoryItem(BaseModel):
    """Trade history item."""
    order_id: int
    symbol: str
    side: str
    quantity: Decimal
    price: Decimal
    slippage_pct: Decimal
    execution_latency_ms: int
    filled_at: datetime
    pnl_inr: Optional[Decimal] = None


class PortfolioSummaryResponse(BaseModel):
    """Portfolio summary response."""
    cash_inr: Decimal
    positions_value_inr: Decimal
    total_value_inr: Decimal
    realized_pnl_inr: Decimal
    unrealized_pnl_inr: Decimal
    win_rate: Decimal
    avg_gain_inr: Decimal
    avg_loss_inr: Decimal
    max_drawdown_pct: Decimal
    positions: List[PositionResponse]


class ResetPortfolioRequest(BaseModel):
    """Request to reset portfolio."""
    confirm: bool = Field(..., description="Must be True to confirm reset")


class ResetPortfolioResponse(BaseModel):
    """Portfolio reset response."""
    reset: bool
    cash_inr: Decimal
    previous_positions_count: int


def to_position_response(pos: Position) -> PositionResponse:
    """Convert Position to response model."""
    return PositionResponse(
        symbol=pos.symbol,
        quantity=pos.quantity,
        avg_cost_inr=pos.avg_cost_inr,
        total_cost_inr=pos.total_cost_inr,
        current_price=pos.current_price,
        current_price_inr=pos.current_price_inr,
        market_value_inr=pos.market_value_inr,
        unrealized_pnl_inr=pos.unrealized_pnl_inr,
        currency=pos.currency,
    )


def to_summary_response(summary: PortfolioSummary) -> PortfolioSummaryResponse:
    """Convert PortfolioSummary to response model."""
    return PortfolioSummaryResponse(
        cash_inr=summary.cash_inr,
        positions_value_inr=summary.positions_value_inr,
        total_value_inr=summary.total_value_inr,
        realized_pnl_inr=summary.realized_pnl_inr,
        unrealized_pnl_inr=summary.unrealized_pnl_inr,
        win_rate=summary.win_rate,
        avg_gain_inr=summary.avg_gain_inr,
        avg_loss_inr=summary.avg_loss_inr,
        max_drawdown_pct=summary.max_drawdown_pct,
        positions=[to_position_response(p) for p in summary.positions],
    )


@router.get(
    "",
    response_model=PortfolioSummaryResponse,
    summary="Get portfolio summary",
)
async def get_portfolio(
    session: AsyncSession = Depends(get_db),
) -> PortfolioSummaryResponse:
    """Get complete portfolio summary including positions and P&L metrics.

    Returns cash balance, positions, realized and unrealized P&L,
    win rate, and performance metrics.
    """
    service = PortfolioService(session)
    summary = await service.get_portfolio_summary()
    return to_summary_response(summary)


@router.get(
    "/positions",
    response_model=List[PositionResponse],
    summary="Get open positions",
)
async def get_positions(
    session: AsyncSession = Depends(get_db),
) -> List[PositionResponse]:
    """Get all open positions with current values.

    Returns positions with quantity, average cost, current price,
    market value, and unrealized P&L.
    """
    service = PortfolioService(session)
    positions = await service.get_positions()
    return [to_position_response(p) for p in positions]


@router.get(
    "/trades",
    response_model=List[TradeHistoryItem],
    summary="Get trade history",
)
async def get_trade_history(
    symbol: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    session: AsyncSession = Depends(get_db),
) -> List[TradeHistoryItem]:
    """Get trade history with fills.

    Query parameters:
    - symbol: Filter by asset symbol
    - start_date: Filter from date (ISO format)
    - end_date: Filter to date (ISO format)
    - limit: Maximum results (1-1000)
    """
    service = PortfolioService(session)
    history = await service.get_trade_history(
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )
    return [TradeHistoryItem(**item) for item in history]


@router.post(
    "/reset",
    response_model=ResetPortfolioResponse,
    summary="Reset portfolio",
)
async def reset_portfolio(
    request: ResetPortfolioRequest,
    session: AsyncSession = Depends(get_db),
) -> ResetPortfolioResponse:
    """Reset portfolio to initial state.

    Archives current state, liquidates all positions at current prices,
    clears all holdings, and resets cash to 100,000 INR.

    Requires confirm=True as safety check.
    """
    if not request.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset requires confirm=True",
        )

    service = PortfolioService(session)
    result = await service.reset_portfolio()

    # Reset and restart order monitor
    try:
        monitor = get_order_monitor()
        await monitor.stop()
        reset_order_monitor()
        new_monitor = get_order_monitor()
        await new_monitor.start()
    except Exception:
        # Monitor reset is optional
        pass

    return ResetPortfolioResponse(
        reset=result["reset"],
        cash_inr=result["cash_inr"],
        previous_positions_count=result["previous_positions_count"],
    )
