"""Portfolio models for trade tracking and P&L calculation."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Boolean,
    DateTime,
    JSON,
    CheckConstraint,
    select,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PortfolioLot(Base):
    """Tracks individual purchase lots for FIFO accounting."""

    __tablename__ = "portfolio_lots"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)

    # Original purchase details
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(19, 8), nullable=False
    )  # total quantity purchased
    cost_basis: Mapped[Decimal] = mapped_column(
        Numeric(19, 8), nullable=False
    )  # per unit in original currency
    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), nullable=False
    )  # total in INR (quantity * cost * fx_rate)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD"
    )  # original currency
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # FIFO tracking
    remaining_quantity: Mapped[Decimal] = mapped_column(
        Numeric(19, 8), nullable=False
    )  # unsold quantity

    # Closure tracking
    is_closed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Realized P&L from this lot (set when fully/partially sold)
    realized_pnl: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("0"), nullable=False
    )

    # Index for FIFO query efficiency
    __table_args__ = (
        Index(
            "ix_portfolio_lots_symbol_open",
            "symbol",
            "acquired_at",
        ),
        CheckConstraint(
            "remaining_quantity <= quantity",
            name="ck_remaining_not_greater_than_quantity"
        ),
        CheckConstraint(
            "remaining_quantity >= 0",
            name="ck_remaining_non_negative"
        ),
    )

    def realize_pnl(self, sell_quantity: Decimal, sell_price_in_inr: Decimal) -> Decimal:
        """Calculate realized P&L for selling a portion of this lot.

        Args:
            sell_quantity: Quantity being sold from this lot
            sell_price_in_inr: Sale price per unit in INR

        Returns:
            Realized P&L for this portion
        """
        if sell_quantity > self.remaining_quantity:
            raise ValueError(
                f"Cannot sell {sell_quantity} from lot holding {self.remaining_quantity}"
            )

        # Calculate cost basis for sold portion in INR
        cost_per_unit_inr = self.total_cost / self.quantity
        portion_cost = cost_per_unit_inr * sell_quantity
        portion_proceeds = sell_price_in_inr * sell_quantity

        # P&L = proceeds - cost
        pnl = portion_proceeds - portion_cost
        return pnl

    def __repr__(self) -> str:
        return (
            f"<PortfolioLot(id={self.id}, symbol={self.symbol}, "
            f"qty={self.remaining_quantity}/{self.quantity}, "
            f"closed={self.is_closed})>"
        )


class UserCash(Base):
    """Stores user's cash balance - single row per user (enforced at app layer)."""

    __tablename__ = "user_cash"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Cash amounts in INR (base currency)
    total_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("100000.00"), nullable=False
    )  # total value including reserved
    reserved_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("0.00"), nullable=False
    )  # cash reserved for open orders
    available_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("100000.00"), nullable=False
    )  # free cash = total - reserved

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Ensure only one row exists via partial unique index
    # This is enforced by creating a unique index on a constant (e.g., single_row = 1)
    # And using a CHECK constraint
    __table_args__ = (
        Index(
            "ix_user_cash_single_row",
            "id",
            unique=True,
        ),
    )

    @property
    def calculated_available(self) -> Decimal:
        """Calculate available cash dynamically."""
        return self.total_inr - self.reserved_inr

    def reserve(self, amount_inr: Decimal) -> None:
        """Reserve cash for an order.

        Raises:
            ValueError: If insufficient available cash
        """
        if amount_inr > self.available_inr:
            raise ValueError(
                f"Insufficient available cash: need {amount_inr}, have {self.available_inr}"
            )
        self.reserved_inr += amount_inr
        self._recalculate_available()

    def release_reservation(self, amount_inr: Decimal) -> None:
        """Release reserved cash (e.g., order cancelled)."""
        self.reserved_inr = max(Decimal("0"), self.reserved_inr - amount_inr)
        self._recalculate_available()

    def deduct_cash(self, amount_inr: Decimal) -> None:
        """Deduct cash from total (used when order fills)."""
        if amount_inr > self.total_inr:
            raise ValueError(f"Insufficient total cash: need {amount_inr}, have {self.total_inr}")
        self.total_inr -= amount_inr
        self._recalculate_available()

    def add_cash(self, amount_inr: Decimal) -> None:
        """Add cash from sale proceeds (used when order fills)."""
        self.total_inr += amount_inr
        self._recalculate_available()

    def _recalculate_available(self) -> None:
        """Update available_inr to match calculated value."""
        self.available_inr = self.total_inr - self.reserved_inr

    @classmethod
    async def get_or_create(cls, session) -> "UserCash":
        """Get existing cash or create default."""
        from sqlalchemy import select
        result = await session.execute(select(cls).limit(1))
        cash = result.scalar_one_or_none()
        if cash is None:
            cash = cls()
            session.add(cash)
            await session.commit()
        return cash

    def __repr__(self) -> str:
        return (
            f"<UserCash(total={self.total_inr}, reserved={self.reserved_inr}, "
            f"available={self.available_inr})>"
        )


class PortfolioSnapshot(Base):
    """Archives portfolio state for history and reset functionality."""

    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Snapshot metadata
    snapshot_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "daily" or "reset"
    captured_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Portfolio values in INR
    cash_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    positions_value_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), nullable=False
    )  # current market value of positions
    total_value_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)

    # P&L metrics
    realized_pnl_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("0"), nullable=False
    )
    unrealized_pnl_inr: Mapped[Decimal] = mapped_column(
        Numeric(19, 2), default=Decimal("0"), nullable=False
    )

    # Serialized data for full reconstruction
    positions_json: Mapped[dict] = mapped_column(
        JSON, nullable=False
    )  # list of positions at snapshot time
    metrics_json: Mapped[dict] = mapped_column(
        JSON, nullable=True
    )  # win_rate, avg_pnl, max_drawdown, etc.

    # Add index for efficient querying by type and date
    __table_args__ = (
        Index(
            "ix_portfolio_snapshots_type_captured",
            "snapshot_type",
            "captured_at",
        ),
        CheckConstraint(
            "snapshot_type IN ('daily', 'reset')",
            name="ck_snapshot_type_values"
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PortfolioSnapshot(id={self.id}, type={self.snapshot_type}, "
            f"total={self.total_value_inr}, captured={self.captured_at})>"
        )
