from typing import List

from app.providers.base import BaseProvider, ProviderError
from app.providers.schemas import AssetPrice


class ProviderRegistry:
    """Provider registry with fallback chain support.

    Tries providers in priority order until one succeeds.
    """

    def __init__(self, providers: List[BaseProvider]):
        self.providers = sorted(providers, key=lambda p: p.priority)

    async def fetch_price(
        self,
        symbol: str,
    ) -> AssetPrice:
        """Fetch price trying providers in priority order.

        Args:
            symbol: Asset symbol to fetch

        Returns:
            AssetPrice from first successful provider

        Raises:
            ProviderError: If all providers fail
        """
        last_error = None

        for provider in self.providers:
            if not await provider.health_check():
                continue

            try:
                price = await provider.fetch_price(symbol)
                return price
            except ProviderError as e:
                last_error = e
                continue

        raise ProviderError(
            f"All providers failed to fetch {symbol}: {last_error}"
        )

    async def health_check_all(self) -> dict[str, bool]:
        """Check health of all providers."""
        return {p.name: await p.health_check() for p in self.providers}

    @classmethod
    def create_default(cls, settings=None) -> "ProviderRegistry":
        """Create registry with default providers."""
        from app.providers.yfinance_provider import YFinanceProvider
        from app.providers.coingecko_provider import CoinGeckoProvider
        from app.config import get_settings

        if settings is None:
            settings = get_settings()

        providers = [YFinanceProvider()]
        providers.append(CoinGeckoProvider(api_key=settings.coingecko_api_key))

        return cls(providers)
