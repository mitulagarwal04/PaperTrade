from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict

from app.providers.schemas import AssetPrice


class ProviderError(Exception):
    """Raised when a provider fails to fetch data."""
    pass


class RateLimitError(ProviderError):
    """Raised when rate limit is hit."""
    pass


class BaseProvider(ABC):
    """Abstract base class for all data providers."""

    name: str
    priority: int = 100

    @abstractmethod
    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current price for symbol."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is reachable and healthy."""
        pass

    @property
    @abstractmethod
    def rate_limit_delay(self) -> float:
        """Seconds between requests to respect rate limits."""
        pass

    async def fetch_historical(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
    ) -> list[AssetPrice]:
        """Optional: fetch historical data."""
        raise NotImplementedError(f"{self.name} does not support historical data")

    def _normalize_symbol(self, symbol: str) -> str:
        """Convert internal symbol to provider-specific format."""
        return symbol.upper()

    def _denormalize_symbol(self, provider_symbol: str) -> str:
        """Convert provider symbol to internal format."""
        return provider_symbol.upper()
