---
phase: 1
plan: 01
wave: 1
depends_on: []
files_modified:
  - backend/requirements.txt
  - backend/pyproject.toml
  - backend/.env.example
  - backend/app/__init__.py
  - backend/app/config.py
  - backend/app/database.py
  - backend/app/cache/models.py
  - backend/app/cache/__init__.py
  - backend/app/cache/manager.py
  - backend/app/providers/__init__.py
  - backend/app/providers/schemas.py
  - backend/app/providers/base.py
autonomous: true
---

# Phase 1, Plan 01: Data Infrastructure Core

## Objective
Build the foundational data infrastructure for real-time market data: configuration, database models, provider abstractions, caching system, and initial providers (yfinance, CoinGecko).

## must_haves
These 5 things MUST be true for phase success:

1. **Live prices update every 5 seconds** - WebSocket broadcasts current prices with no more than 5-second delay
2. **All prices normalized to AssetPrice schema** - Every provider returns consistent format regardless of source  
3. **Stale data served gracefully** - When APIs fail, last known price is returned with is_stale=True instead of error
4. **Provider fallback chain works** - If yfinance fails, system falls back to CoinGecko automatically
5. **PostgreSQL cache persists data** - 5-minute TTL with stale-while-revalidate, cache survives restarts

## Risk
- **yfinance rate limiting**: Undocumented limits may require delays or fallbacks
- **CoinGecko API key**: Free tier now requires key; may need registration
- **WebSocket connection leaks**: Must handle disconnections gracefully

---

<task>
<id>01-01-01</id>
<title>Setup project dependencies and configuration</title>
<description>Create Python project structure with FastAPI, SQLAlchemy, and data fetching dependencies. Add Pydantic settings for environment-based configuration.</description>
<read_first>
- docs/superpowers/plans/2026-04-15-phase-1-data-infrastructure.md - See Task 1 for exact dependency versions
</read_first>
<action>
Create these files:

1. backend/requirements.txt with exact versions:
```
fastapi==0.135.2
uvicorn[standard]==0.44.0
pydantic==2.12.4
pydantic-settings==2.8.1
sqlalchemy==2.0.49
alembic==1.8.1
asyncpg==0.29.0
yfinance==1.2.2
aiohttp==3.9.5
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.7
python-dotenv==1.0.1
```

2. backend/pyproject.toml:
```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "papertrade"
version = "0.1.0"
requires-python = ">=3.11"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py"]
```

3. backend/.env.example:
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/papertrade
DEBUG=true
PRICE_UPDATE_INTERVAL=5
CACHE_TTL_SECONDS=300
COINGECKO_API_KEY=
ALPHAVANTAGE_API_KEY=
TWELVEDATA_API_KEY=
```

4. backend/app/__init__.py:
```python
"""PaperTrade backend application."""
__version__ = "0.1.0"
```

5. backend/app/config.py:
```python
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    database_url: str
    debug: bool = False
    price_update_interval: int = 5
    cache_ttl_seconds: int = 300
    coingecko_api_key: Optional[str] = None
    alphavantage_api_key: Optional[str] = None
    twelvedata_api_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

6. backend/app/database.py:
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def make_session_factory():
    """Create and return an async session factory."""
    global _engine, _session_factory
    settings = get_settings()
    _engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_size=20,
        max_overflow=30,
        pool_timeout=30,
    )
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return _session_factory


async def get_session() -> AsyncSession:
    """Get a database session. Factory is lazily initialized."""
    global _session_factory
    if _session_factory is None:
        _session_factory = make_session_factory()
    async with _session_factory() as session:
        yield session


async def init_db():
    """Initialize database tables."""
    global _engine
    if _engine is None:
        make_session_factory()
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```
</action>
<acceptance_criteria>
- backend/requirements.txt exists with all dependencies listed
- backend/pyproject.toml exists with pytest config
- backend/.env.example exists with DATABASE_URL default
- backend/app/__init__.py exists with __version__
- backend/app/config.py exists with Settings class, get_settings() function
- backend/app/database.py exists with Base, get_session(), init_db()
- `cd backend && python -c "from app.config import Settings; print('config ok')"` outputs "config ok"
- `cd backend && python -c "from app.database import Base; print('db ok')"` outputs "db ok"
</acceptance_criteria>
<requirements>INFRA-03</requirements>
<wave>1</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-02</id>
<title>Create AssetPrice schema and Provider base class</title>
<description>Define standard AssetPrice Pydantic model that all providers will return. Create abstract BaseProvider class with error types.</description>
<read_first>
- backend/app/config.py - See project settings
</read_first>
<action>
Create these files:

1. backend/app/providers/__init__.py:
```python
"""Data providers module."""
from app.providers.schemas import AssetPrice

__all__ = ["AssetPrice"]
```

2. backend/app/providers/schemas.py:
```python
from datetime import datetime
from typing import Optional
import re

from pydantic import BaseModel, field_validator


class AssetPrice(BaseModel):
    """Standardized price data across all providers."""

    symbol: str
    price: float
    currency: str
    timestamp: datetime
    source: str
    is_stale: bool = False

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Validate symbol format - alphanumeric with limited special chars."""
        if not re.match(r'^[A-Za-z0-9\-./]+$', v):
            raise ValueError(f"Invalid symbol format: {v}")
        return v.upper()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Ensure currency is 3-letter code."""
        v = v.upper()
        if len(v) != 3:
            raise ValueError(f"Currency must be 3-letter code, got: {v}")
        return v

    def with_stale_flag(self, stale: bool = True) -> "AssetPrice":
        """Return copy with stale flag set."""
        data = self.model_dump()
        data["is_stale"] = stale
        return AssetPrice(**data)
```

3. backend/app/providers/base.py:
```python
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
```
</action>
<acceptance_criteria>
- backend/app/providers/__init__.py exists
- backend/app/providers/schemas.py exists with AssetPrice class
- backend/app/providers/base.py exists with BaseProvider, ProviderError, RateLimitError
- `cd backend && python -c "from app.providers.schemas import AssetPrice; p = AssetPrice(symbol='AAPL', price=150.0, currency='USD', timestamp=__import__('datetime').datetime.utcnow(), source='test'); print('schema ok')"` outputs "schema ok"
- `cd backend && python -c "from app.providers.base import BaseProvider, ProviderError; print('base ok')"` outputs "base ok"
- AssetPrice validates symbol with field_validator (rejects special chars)
- AssetPrice validates currency is 3-letter code
</acceptance_criteria>
<requirements>INFRA-02</requirements>
<wave>1</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-03</id>
<title>Create PostgreSQL cache models and CacheManager</title>
<description>Implement PostgreSQL-based cache with PriceCache ORM model and CacheManager with stale-while-revalidate pattern.</description>
<read_first>
- backend/app/database.py - See Base class
- backend/app/providers/schemas.py - See AssetPrice model
</read_first>
<action>
Create these files:

1. backend/app/cache/__init__.py:
```python
"""Cache module for PaperTrade."""
from app.cache.models import PriceCache

__all__ = ["PriceCache"]
```

2. backend/app/cache/models.py:
```python
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
```

3. backend/app/cache/manager.py:
```python
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
```
</action>
<acceptance_criteria>
- backend/app/cache/__init__.py exists
- backend/app/cache/models.py exists with PriceCache class
- backend/app/cache/manager.py exists with CacheManager class
- PriceCache has id, symbol, price, currency, source, timestamp columns
- PriceCache.is_fresh(ttl_seconds) returns True for recent data, False for old
- PriceCache.to_price() returns AssetPrice with is_stale=False
- CacheManager.get() returns None for missing cache
- CacheManager.get() returns price with is_stale=True for expired cache
- CacheManager.get_or_fetch() calls fetcher when cache miss
- CacheManager.get_or_fetch() returns stale data when fetcher fails (graceful degradation)
</acceptance_criteria>
<requirements>INFRA-03, INFRA-04</requirements>
<wave>2</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-04</id>
<title>Implement YFinance provider for equities and crypto</title>
<description>Create YFinanceProvider class that fetches stock prices from Yahoo Finance using yfinance library. Handle rate limiting and crypto symbol normalization.</description>
<read_first>
- backend/app/providers/base.py - See BaseProvider interface
- backend/app/providers/schemas.py - See AssetPrice model
</read_first>
<action>
Create backend/app/providers/yfinance_provider.py:

```python
import asyncio
from datetime import datetime
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
            timestamp=datetime.utcnow(),
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
```
</action>
<acceptance_criteria>
- backend/app/providers/yfinance_provider.py exists with YFinanceProvider class
- YFinanceProvider.name = "yfinance"
- YFinanceProvider.priority = 10
- YFinanceProvider.rate_limit_delay = 1.0
- YFinanceProvider.fetch_price("AAPL") works (mock test ok)
- YFinanceProvider._normalize_symbol("BTC") returns "BTC-USD"
- YFinanceProvider._normalize_symbol("AAPL") returns "AAPL"
- YFinanceProvider.health_check() returns bool
- Fetch prices from yfinance in thread pool to avoid blocking
</acceptance_criteria>
<requirements>INFRA-01</requirements>
<wave>3</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-05</id>
<title>Implement CoinGecko provider for crypto prices</title>
<description>Create CoinGeckoProvider class that fetches cryptocurrency prices from CoinGecko public API. Handle rate limits and symbol mapping to coin IDs.</description>
<read_first>
- backend/app/providers/base.py - See BaseProvider interface
- backend/app/config.py - See API key settings
</read_first>
<action>
Create backend/app/providers/coingecko_provider.py:

```python
from datetime import datetime

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
```
</action>
<acceptance_criteria>
- backend/app/providers/coingecko_provider.py exists with CoinGeckoProvider class
- CoinGeckoProvider.name = "coingecko"
- CoinGeckoProvider.priority = 20
- CoinGeckoProvider.rate_limit_delay = 6.0
- CoinGeckoProvider._normalize_symbol("BTC") returns "bitcoin"
- CoinGeckoProvider.fetch_price("BTC") works with httpx async client
- Handles HTTP 429 as RateLimitError
- Supports optional API key
</acceptance_criteria>
<requirements>INFRA-01</requirements>
<wave>3</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-06</id>
<title>Create ProviderRegistry with fallback chain</title>
<description>Implement ProviderRegistry class that manages multiple providers and tries them in priority order until one succeeds. Create default registry factory.</description>
<read_first>
- backend/app/providers/base.py - See BaseProvider interface
- backend/app/providers/yfinance_provider.py - See YFinanceProvider
- backend/app/providers/coingecko_provider.py - See CoinGeckoProvider
</read_first>
<action>
Create backend/app/providers/registry.py:

```python
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
```
</action>
<acceptance_criteria>
- backend/app/providers/registry.py exists with ProviderRegistry class
- ProviderRegistry.__init__ sorts providers by priority (lower first)
- ProviderRegistry.fetch_price() tries providers in order
- ProviderRegistry.fetch_price() skips unhealthy providers
- ProviderRegistry.fetch_price() raises ProviderError when all fail
- ProviderRegistry.health_check_all() returns dict of {name: healthy}
- ProviderRegistry.create_default() returns registry with yfinance + coingecko
</acceptance_criteria>
<requirements>INFRA-01, INFRA-04</requirements>
<wave>3</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-07</id>
<title>Create WebSocket ConnectionManager for broadcasting</title>
<description>Implement ConnectionManager class that tracks active WebSocket connections and broadcasts price updates. Handle disconnections gracefully to prevent memory leaks.</description>
<read_first>
- backend/app/providers/schemas.py - See AssetPrice for broadcast format
</read_first>
<action>
Create files:

1. backend/app/websocket/__init__.py:
```python
"""WebSocket module for real-time price updates."""
from app.websocket.manager import ConnectionManager

__all__ = ["ConnectionManager"]
```

2. backend/app/websocket/manager.py:
```python
from typing import List

from fastapi import WebSocket


class ConnectionManager:
    """WebSocket connection manager.

    Tracks active connections and broadcasts messages to all clients.
    Handles disconnections gracefully.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and register a new connection."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Remove a connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> int:
        """Broadcast message to all connected clients.

        Returns:
            Number of clients that received the message
        """
        disconnected = []
        sent_count = 0

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                sent_count += 1
            except (RuntimeError, Exception):
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

        return sent_count

    async def send_to(self, websocket: WebSocket, message: dict) -> bool:
        """Send message to specific client."""
        try:
            await websocket.send_json(message)
            return True
        except (RuntimeError, Exception):
            self.disconnect(websocket)
            return False
```
</action>
<acceptance_criteria>
- backend/app/websocket/__init__.py exists
- backend/app/websocket/manager.py exists with ConnectionManager class
- ConnectionManager.connect() accepts websocket and adds to active_connections
- ConnectionManager.disconnect() removes websocket from active_connections
- ConnectionManager.broadcast() sends to all connections
- ConnectionManager.broadcast() removes failed connections (no memory leaks)
- ConnectionManager.broadcast() returns count of successful sends
- ConnectionManager.send_to() sends to specific connection
</acceptance_criteria>
<requirements>INFRA-01</requirements>
<wave>3</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-08</id>
<title>Create FastAPI main app with WebSocket endpoint</title>
<description>Implement FastAPI application with lifespan management for database initialization and background price fetching. Add REST API endpoints and WebSocket for real-time updates.</description>
<read_first>
- backend/app/database.py - See init_db() function
- backend/app/providers/registry.py - See ProviderRegistry
- backend/app/websocket/manager.py - See ConnectionManager
- backend/app/cache/manager.py - See CacheManager
</read_first>
<action>
Create these files:

1. backend/app/api/__init__.py:
```python
"""API module."""
```

2. backend/app/api/deps.py:
```python
from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async for session in get_session():
        yield session


DBSession = Depends(get_db)
```

3. backend/app/api/routes/__init__.py:
```python
"""API routes."""
```

4. backend/app/api/routes/prices.py:
```python
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
```

5. backend/app/main.py:
```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.routes.prices import router as prices_router
from app.websocket.manager import ConnectionManager
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry

ws_manager = ConnectionManager()


async def broadcast_prices(app: FastAPI):
    """Background task to fetch and broadcast prices."""
    from app.database import make_session_factory

    session_factory = make_session_factory()

    while True:
        try:
            async with session_factory() as session:
                cache = CacheManager(session)
                registry = ProviderRegistry.create_default()

                symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "BTC", "ETH"]
                prices = {}

                for symbol in symbols:
                    try:
                        price = await registry.fetch_price(symbol)
                        await cache.set(symbol, price)
                        prices[symbol] = {
                            "price": price.price,
                            "currency": price.currency,
                            "source": price.source,
                        }
                    except Exception:
                        cached = await cache.get(symbol)
                        if cached:
                            prices[symbol] = {
                                "price": cached.price,
                                "currency": cached.currency,
                                "source": cached.source,
                                "is_stale": True,
                            }

                if prices:
                    await ws_manager.broadcast({
                        "type": "prices",
                        "data": prices,
                    })

        except Exception as e:
            print(f"Price broadcast error: {e}")

        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    await init_db()
    app.state.price_task = asyncio.create_task(broadcast_prices(app))
    yield
    app.state.price_task.cancel()
    try:
        await app.state.price_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    app = FastAPI(
        title="PaperTrade API",
        description="Real-time paper trading platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(prices_router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {"message": "PaperTrade API", "version": "0.1.0"}

    @app.websocket("/ws/prices")
    async def websocket_prices(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        except Exception:
            ws_manager.disconnect(websocket)

    return app


app = create_app()
```
</action>
<acceptance_criteria>
- backend/app/api/__init__.py exists
- backend/app/api/deps.py exists with get_db() dependency
- backend/app/api/routes/__init__.py exists
- backend/app/api/routes/prices.py exists with router, get_price(), health_check(), list_assets()
- backend/app/main.py exists with create_app(), lifespan context
- App initializes database on startup via init_db()
- App starts background price broadcaster task
- WebSocket endpoint /ws/prices accepts connections and handles pings
- REST endpoints exist: /api/v1/prices/{symbol}, /api/v1/health, /api/v1/assets
- CORS middleware configured
</acceptance_criteria>
<requirements>INFRA-01, INFRA-02, INFRA-03, INFRA-04</requirements>
<wave>4</wave>
<autonomous>true</autonomous>
</task>

<task>
<id>01-01-09</id>
<title>Create pytest fixtures and test configuration</title>
<description>Setup pytest with asyncio support, create conftest.py with database fixtures and mock utilities for testing.</description>
<read_first>
- backend/app/database.py - See Base class
- backend/pyproject.toml - See pytest config
</read_first>
<action>
Create these files:

1. backend/tests/__init__.py:
```python
"""Tests package."""
```

2. backend/tests/conftest.py:
```python
import asyncio
import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import Base


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_db_session():
    """Create a fresh database session for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def mock_cache_manager():
    """Mock cache manager."""
    mock = MagicMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=None)
    return mock
```

3. Create test directories:
```bash
mkdir -p backend/tests/unit
mkdir -p backend/tests/integration
```

4. Create __init__.py files:
```python
# backend/tests/unit/__init__.py
# backend/tests/integration/__init__.py
```
</action>
<acceptance_criteria>
- backend/tests/__init__.py exists
- backend/tests/conftest.py exists with event_loop, async_db_session, mock_cache_manager fixtures
- backend/tests/unit/__init__.py exists
- backend/tests/integration/__init__.py exists
- `cd backend && python -m pytest --collect-only` runs without errors
</acceptance_criteria>
<requirements>INFRA-03</requirements>
<wave>4</wave>
<autonomous>true</autonomous>
</task>

---

## Verification

### For /gsd-verify-work

**Success Criteria:**
1. App starts: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &`
2. Health endpoint responds: `curl http://localhost:8000/api/v1/health` returns `{"status":"ok"}`
3. Prices endpoint works: `curl http://localhost:8000/api/v1/prices/AAPL` returns price data
4. WebSocket connects: `websocat ws://localhost:8000/ws/prices` and receives price broadcasts every 5 seconds
5. Stale data works: (disconnect internet temporarily) API returns cached prices with is_stale=true

**Manual Commands:**
```bash
# Install dependencies
cd backend && pip install -r requirements.txt

# Start PostgreSQL (or use SQLite by changing DATABASE_URL)
docker run -d --name papertrade-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=papertrade -p 5432:5432 postgres:15

# Run tests
pytest tests/ -v

# Start app
cd backend && uvicorn app.main:app --reload
```

**Expected State Changes:**
- backend/ directory exists with all required files
- Can run app with `uvicorn app.main:app`
- Can fetch prices via REST and WebSocket
- Prices are cached in PostgreSQL
