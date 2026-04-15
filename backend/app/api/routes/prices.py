from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry
from app.providers.schemas import AssetPrice
from app.config import get_settings

router = APIRouter()


class PriceService:
    """Service for fetching prices with caching and fallback."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.cache = CacheManager(session)
        self.registry = ProviderRegistry.create_default()

    async def get_price(self, symbol: str) -> AssetPrice:
        """Get price for symbol, using cache or fetching fresh."""
        settings = get_settings()

        cached = await self.cache.get(symbol, ttl_seconds=settings.cache_ttl_seconds)
        if cached and not cached.is_stale:
            return cached

        try:
            price = await self.registry.fetch_price(symbol)
            await self.cache.set(symbol, price)
            return price
        except Exception:
            if cached:
                return cached
            raise HTTPException(status_code=503, detail=f"No price available for {symbol}")


@router.get("/prices/{symbol}", response_model=dict)
async def get_price(symbol: str, session: AsyncSession = Depends(get_db)):
    """Get current price for an asset."""
    service = PriceService(session)
    price = await service.get_price(symbol.upper())
    return {
        "symbol": price.symbol,
        "price": price.price,
        "currency": price.currency,
        "timestamp": price.timestamp.isoformat(),
        "source": price.source,
        "is_stale": price.is_stale,
    }


@router.get("/health")
async def health_check():
    """API health check endpoint."""
    return {"status": "ok"}


@router.get("/assets")
async def list_assets():
    """List supported assets."""
    return [
        {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "currency": "USD"},
        {"symbol": "MSFT", "name": "Microsoft", "type": "stock", "currency": "USD"},
        {"symbol": "GOOGL", "name": "Alphabet", "type": "stock", "currency": "USD"},
        {"symbol": "TSLA", "name": "Tesla", "type": "stock", "currency": "USD"},
        {"symbol": "BTC", "name": "Bitcoin", "type": "crypto", "currency": "USD"},
        {"symbol": "ETH", "name": "Ethereum", "type": "crypto", "currency": "USD"},
    ]
