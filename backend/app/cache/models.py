from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import Float, String, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

if TYPE_CHECKING:
    from app.providers.schemas import AssetPrice


class PriceCache(Base):
    __tablename__ = "price_cache"
    __table_args__ = (
        Index("ix_symbol_timestamp", "symbol", "timestamp"),
        Index("ix_symbol_source", "symbol", "source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    def is_fresh(self, ttl_seconds: int = 300) -> bool:
        """Check if cache entry is within TTL."""
        age = datetime.utcnow() - self.timestamp
        return age < timedelta(seconds=ttl_seconds)

    def to_price(self) -> "AssetPrice":
        """Convert cache entry to AssetPrice model."""
        from app.providers.schemas import AssetPrice
        return AssetPrice(
            symbol=self.symbol,
            price=self.price,
            currency=self.currency,
            timestamp=self.timestamp,
            source=self.source,
            is_stale=False,
        )
