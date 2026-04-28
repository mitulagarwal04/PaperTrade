import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.providers.base import BaseProvider, ProviderError
from app.providers.schemas import AssetPrice


class YFinanceProvider(BaseProvider):
    """Yahoo Finance data provider via yfinance library.

    Supports stocks, ETFs, indices, and some crypto.
    Rate limit: undocumented, but be respectful (~1 req/sec).
    """

    name = "yfinance"
    priority = 10  # Try first for equities

    @property
    def rate_limit_delay(self) -> float:
        return 1.0

    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current price from Yahoo Finance."""
        try:
            return await asyncio.get_event_loop().run_in_executor(
                None, self._fetch_sync, symbol
            )
        except Exception as e:
            raise ProviderError(f"yfinance fetch failed for {symbol}: {e}")

    def _fetch_sync(self, symbol: str) -> AssetPrice:
        """Synchronous fetch using yfinance."""
        import yfinance as yf

        normalized = self._normalize_symbol(symbol)
        ticker = yf.Ticker(normalized)
        info = ticker.info

        if not info:
            raise ProviderError(f"No data returned for {normalized}")

        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        if price is None:
            raise ProviderError(f"Could not extract price for {normalized}")

        return AssetPrice(
            symbol=symbol.upper(),
            price=float(price),
            currency=info.get("currency", "USD").upper(),
            timestamp=datetime.now(timezone.utc),
            source=self.name,
        )

    async def health_check(self) -> bool:
        """Check if Yahoo Finance is reachable."""
        try:
            await self.fetch_price("AAPL")
            return True
        except Exception:
            return False

    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol for Yahoo Finance."""
        symbol = symbol.upper()

        crypto_map = {
            "BTC": "BTC-USD",
            "ETH": "ETH-USD",
            "SOL": "SOL-USD",
            "ADA": "ADA-USD",
            "DOT": "DOT-USD",
        }

        if symbol in crypto_map and "-USD" not in symbol:
            return crypto_map[symbol]

        return symbol
