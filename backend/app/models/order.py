"""Order models for trading system."""
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderSide(str, Enum):
    """Order side: BUY or SELL."""

    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    """Order type: MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT."""

    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"


class OrderStatus(str, Enum):
    """Order status lifecycle."""

    PENDING = "PENDING"
    OPEN = "OPEN"
    PARTIAL_FILLED = "PARTIAL_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class Order(Base):
    """Represents a trading order with state machine."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    side: Mapped[OrderSide] = mapped_column(SQLEnum(OrderSide), nullable=False)
    order_type: Mapped[OrderType] = mapped_column(
        SQLEnum(OrderType), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8), nullable=False)
    filled_quantity: Mapped[Decimal] = mapped_column(
        Numeric(19, 8), default=Decimal("0")
    )
    price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 8), nullable=True
    )  # null for market orders
    stop_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(19, 8), nullable=True
    )  # for stop/take-profit orders
    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(OrderStatus),
        default=OrderStatus.PENDING,
        index=True,
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3), default="USD", nullable=False
    )  # original currency
    reserved_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("0")
    )  # cash reserved for this order

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    filled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Cancellation reason
    cancel_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationship to fills
    fills: Mapped[list["TradeFill"]] = relationship(
        "TradeFill",
        back_populates="order",
        order_by="TradeFill.filled_at",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def remaining_quantity(self) -> Decimal:
        """Get remaining quantity to fill."""
        return self.quantity - self.filled_quantity

    @property
    def is_filled(self) -> bool:
        """Check if order is fully filled."""
        return self.filled_quantity >= self.quantity

    def __repr__(self) -> str:
        return (
            f"<Order(id={self.id}, symbol={self.symbol}, side={self.side}, "
            f"type={self.order_type}, qty={self.quantity}, status={self.status})>"
        )


class TradeFill(Base):
    """Represents a trade fill/execution record."""

    __tablename__ = "trade_fills"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    fill_sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )  # sequence for partial fills
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(19, 8), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    slippage_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0")
    )  # e.g., 0.0010 = 0.10%
    execution_latency_ms: Mapped[int] = mapped_column(
        Integer, default=0
    )  # simulated latency
    filled_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, nullable=False
    )

    # Relationship to order
    order: Mapped[Order] = relationship("Order", back_populates="fills")

    # Unique constraint to prevent duplicate fills
    __table_args__ = (
        UniqueConstraint("order_id", "fill_sequence", name="uq_fill_sequence"),
        Index("ix_trade_fills_filled_at", "filled_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<TradeFill(id={self.id}, order_id={self.order_id}, "
            f"qty={self.quantity}, price={self.price})>"
        )
