from datetime import datetime
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.models import PriceCache
from app.providers.schemas import AssetPrice


class CacheManager:
    """PostgreSQL-based cache with stale-while-revalidate pattern."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(
        self,
        key: str,
        ttl_seconds: int = 300,
    ) -> Optional[AssetPrice]:
        """Get cached price. Returns None if expired or missing."""
        cached = await self._get_cached_entry(key)

        if cached is None:
            return None

        if cached.is_fresh(ttl_seconds):
            return cached.to_price()
        else:
            price = cached.to_price()
            price.is_stale = True
            return price

    async def get_or_fetch(
        self,
        key: str,
        fetcher: callable,
        ttl_seconds: int = 300,
    ) -> tuple[AssetPrice, bool]:
        """Get from cache or fetch if missing/expired.
        Returns: (price, is_fresh)
        """
        cached = await self._get_cached_entry(key)
        if cached and cached.is_fresh(ttl_seconds):
            return cached.to_price(), True

        try:
            price = await fetcher()
            await self.set(key, price)
            return price, True
        except Exception:
            if cached:
                price = cached.to_price()
                price.is_stale = True
                return price, False
            raise

    async def set(self, key: str, price: AssetPrice) -> None:
        """Store price in cache."""
        cache_entry = PriceCache(
            symbol=key,
            price=price.price,
            currency=price.currency,
            source=price.source,
            timestamp=price.timestamp,
        )
        self.session.add(cache_entry)
        await self.session.commit()

    async def invalidate(self, key: str) -> None:
        """Remove cache entry."""
        entry = await self._get_cached_entry(key)
        if entry:
            await self.session.delete(entry)
            await self.session.commit()

    async def _get_cached_entry(self, key: str) -> Optional[PriceCache]:
        """Get most recent cache entry for symbol."""
        result = await self.session.execute(
            select(PriceCache)
            .where(PriceCache.symbol == key.upper())
            .order_by(desc(PriceCache.timestamp))
            .limit(1)
        )
        return result.scalar_one_or_none()
