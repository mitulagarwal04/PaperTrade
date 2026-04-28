from datetime import datetime, timezone

import httpx

from app.providers.base import BaseProvider, ProviderError, RateLimitError
from app.providers.schemas import AssetPrice


class CoinGeckoProvider(BaseProvider):
    """CoinGecko API provider for cryptocurrency data.

    Free tier: 10-30 calls/minute
    https://www.coingecko.com/en/api
    """

    name = "coingecko"
    priority = 20  # Second choice after yfinance for crypto

    BASE_URL = "https://api.coingecko.com/api/v3"

    SYMBOL_MAP = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "ADA": "cardano",
        "DOT": "polkadot",
        "MATIC": "matic-network",
        "AVAX": "avalanche-2",
        "LINK": "chainlink",
        "UNI": "uniswap",
        "AAVE": "aave",
    }

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key

    @property
    def rate_limit_delay(self) -> float:
        return 6.0  # 10 calls/min = 6 sec between

    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current crypto price from CoinGecko."""
        coin_id = self._normalize_symbol(symbol)

        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.BASE_URL}/simple/price"
                params = {
                    "ids": coin_id,
                    "vs_currencies": "usd",
                }
                if self.api_key:
                    params["x_cg_demo_api_key"] = self.api_key

                response = await client.get(url, params=params, timeout=30.0)
                response.raise_for_status()
                data = response.json()

                if coin_id not in data:
                    raise ProviderError(f"No price data for {symbol} (id: {coin_id})")

                price = data[coin_id].get("usd")
                if price is None:
                    raise ProviderError(f"No USD price for {symbol}")

                return AssetPrice(
                    symbol=symbol.upper(),
                    price=float(price),
                    currency="USD",
                    timestamp=datetime.utcnow(),
                    source=self.name,
                )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise RateLimitError(f"CoinGecko rate limit exceeded: {e}")
            raise ProviderError(f"CoinGecko HTTP error: {e}")
        except Exception as e:
            raise ProviderError(f"CoinGecko fetch failed for {symbol}: {e}")

    async def health_check(self) -> bool:
        """Check if CoinGecko API is reachable."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.BASE_URL}/ping", timeout=10.0)
                return response.status_code == 200
        except Exception:
            return False

    def _normalize_symbol(self, symbol: str) -> str:
        """Convert symbol to CoinGecko coin ID."""
        symbol = symbol.upper()
        return self.SYMBOL_MAP.get(symbol, symbol.lower())
