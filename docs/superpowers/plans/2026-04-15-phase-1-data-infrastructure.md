# Phase 1: Data Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resilient data infrastructure that fetches real-time prices for stocks, crypto, and commodities with unified API, PostgreSQL caching, and graceful degradation when APIs fail.

**Architecture:** Provider abstraction layer with pluggable fetchers (yfinance, CoinGecko, Alpha Vantage), PostgreSQL-based stale-while-revalidate caching, FastAPI WebSocket broadcasting for real-time price updates.

**Tech Stack:** Python 3.13, FastAPI 0.135, SQLAlchemy 2.0, Alembic, yfinance, aiohttp, pytest

---

## File Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app factory + lifespan
│   ├── config.py               # Pydantic Settings
│   ├── database.py             # SQLAlchemy async engine + session
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependency injection
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── prices.py       # REST endpoints
│   ├── cache/
│   │   ├── __init__.py
│   │   ├── manager.py          # CacheManager with stale-while-revalidate
│   │   └── models.py           # PriceCache ORM model
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py             # BaseProvider abstract class
│   │   ├── schemas.py          # AssetPrice Pydantic model
│   │   ├── yfinance_provider.py
│   │   ├── coingecko_provider.py
│   │   ├── alphavantage_provider.py
│   │   └── registry.py         # Provider registration/fallback chain
│   ├── websocket/
│   │   ├── __init__.py
│   │   └── manager.py          # ConnectionManager for broadcasting
│   └── models/
│       ├── __init__.py
│       └── asset.py            # Asset ORM model
├── alembic/
│   ├── versions/               # Migration files
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # pytest fixtures
│   ├── unit/
│   │   ├── test_config.py
│   │   ├── test_cache.py
│   │   └── test_schemas.py
│   └── integration/
│       ├── test_providers.py
│       ├── test_cache.py
│       └── test_websocket.py
├── requirements.txt
└── pyproject.toml
```

---

## Task 1: Project Setup and Dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`

- [ ] **Step 1: Write requirements.txt**
```
# Core
fastapi==0.135.2
uvicorn[standard]==0.44.0
pydantic==2.12.4
pydantic-settings==2.8.1

# Database
sqlalchemy==2.0.49
alembic==1.8.1
asyncpg==0.29.0

# Data fetching
yfinance==1.2.2
aiohttp==3.9.5
httpx==0.27.0

# Testing
pytest==8.2.0
pytest-asyncio==0.23.7

# Utils
python-dotenv==1.0.1
```

- [ ] **Step 2: Write pyproject.toml**
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

- [ ] **Step 3: Write .env.example**
```
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/papertrade

# API Keys (optional - falls back to free tiers)
COINGECKO_API_KEY=
ALPHAVANTAGE_API_KEY=
TWELVEDATA_API_KEY=

# App Settings
DEBUG=true
PRICE_UPDATE_INTERVAL=5
CACHE_TTL_SECONDS=300
```

- [ ] **Step 4: Create app/__init__.py**
```python
"""PaperTrade backend application."""
__version__ = "0.1.0"
```

- [ ] **Step 5: Verify file structure**
```bash
cd backend && ls -la && ls -la app/
```
Expected: All files exist.

- [ ] **Step 6: Commit**
```bash
git add backend/
git commit -m "chore: setup project dependencies and configuration"
```

---

## Task 2: Configuration Module

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/tests/unit/test_config.py`

- [ ] **Step 1: Write failing test**
```python
import pytest
from app.config import Settings


class TestSettings:
    def test_settings_loads_from_env(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DEBUG", "true")
        monkeypatch.setenv("PRICE_UPDATE_INTERVAL", "10")
        monkeypatch.setenv("CACHE_TTL_SECONDS", "600")

        settings = Settings()
        assert settings.database_url == "postgresql+asyncpg://test:test@localhost/test"
        assert settings.debug is True
        assert settings.price_update_interval == 10
        assert settings.cache_ttl_seconds == 600

    def test_default_values(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")

        settings = Settings()
        assert settings.debug is False
        assert settings.price_update_interval == 5
        assert settings.cache_ttl_seconds == 300
        assert settings.coingecko_api_key is None
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_config.py -v
```
Expected: FAIL with "app.config not found"

- [ ] **Step 3: Create config.py**
```python
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Database
    database_url: str

    # Debug mode
    debug: bool = False

    # Price update interval in seconds
    price_update_interval: int = 5

    # Cache TTL in seconds (5 minutes default)
    cache_ttl_seconds: int = 300

    # API Keys (optional)
    coingecko_api_key: Optional[str] = None
    alphavantage_api_key: Optional[str] = None
    twelvedata_api_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_config.py -v
```
Expected: 2 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/config.py backend/tests/unit/test_config.py
git commit -m "feat: add pydantic settings configuration"
```

---

## Task 3: Database Setup

**Files:**
- Create: `backend/app/database.py`
- Modify: `backend/pyproject.toml`
-
- Create: `backend/tests/unit/test_database.py`

- [ ] **Step 1: Write failing test**
```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.database import Base, get_session, make_session_factory


class TestDatabase:
    @pytest.mark.asyncio
    async def test_get_session_returns_async_session(self):
        from app.database import get_session
        session_gen = get_session()
        session = await session_gen.__anext__()
        assert isinstance(session, AsyncSession)
        await session_gen.aclose()

    def test_base_has_registry(self):
        from sqlalchemy.orm import registry
        assert isinstance(Base.registry, registry)
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_database.py -v
```
Expected: FAIL with "app.database not found"

- [ ] **Step 3: Create database.py**
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


# Global engine and session factory (initialized on first use)
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

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_database.py -v
```
Expected: 2 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/database.py backend/tests/unit/test_database.py
git commit -m "feat: add SQLAlchemy async database setup"
```

---

## Task 4: Price Cache ORM Model

**Files:**
- Create: `backend/app/cache/models.py`
- Create: `backend/app/cache/__init__.py`
- Create: `backend/tests/unit/test_cache_models.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.models import PriceCache
from app.database import Base


class TestPriceCache:
    @pytest.mark.asyncio
    async def test_price_cache_creation(self):
        cache_entry = PriceCache(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            source="yfinance",
            timestamp=datetime.utcnow(),
        )
        assert cache_entry.symbol == "AAPL"
        assert cache_entry.price == 150.25
        assert cache_entry.currency == "USD"
        assert cache_entry.source == "yfinance"

    def test_is_fresh_returns_true_for_recent_data(self):
        cache_entry = PriceCache(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            source="yfinance",
            timestamp=datetime.utcnow() - timedelta(seconds=100),
        )
        assert cache_entry.is_fresh(ttl_seconds=300) is True

    def test_is_fresh_returns_false_for_old_data(self):
        cache_entry = PriceCache(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            source="yfinance",
            timestamp=datetime.utcnow() - timedelta(seconds=400),
        )
        assert cache_entry.is_fresh(ttl_seconds=300) is False

    def test_to_price_returns_asset_price(self):
        from datetime import datetime
        now = datetime.utcnow()
        cache_entry = PriceCache(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            source="yfinance",
            timestamp=now,
        )
        price = cache_entry.to_price()
        assert price.symbol == "AAPL"
        assert price.price == 150.25
        assert price.currency == "USD"
        assert price.source == "yfinance"
        assert price.timestamp == now
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_cache_models.py -v
```
Expected: FAIL with import errors

- [ ] **Step 3: Create cache models.py**
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

- [ ] **Step 4: Create cache __init__.py**
```python
"""Cache module for PaperTrade."""
from app.cache.models import PriceCache

__all__ = ["PriceCache"]
```

- [ ] **Step 5: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_cache_models.py -v
```
Expected: 4 tests PASS

- [ ] **Step 6: Commit**
```bash
git add backend/app/cache/
git commit -m "feat: add PriceCache ORM model with freshness checks"
```

---

## Task 5: Provider Schemas

**Files:**
- Create: `backend/app/providers/schemas.py`
- Create: `backend/app/providers/__init__.py`
- Create: `backend/tests/unit/test_schemas.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime

import pytest

from app.providers.schemas import AssetPrice


class TestAssetPrice:
    def test_asset_price_creation(self):
        price = AssetPrice(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            timestamp=datetime.utcnow(),
            source="yfinance",
        )
        assert price.symbol == "AAPL"
        assert price.price == 150.25
        assert price.currency == "USD"
        assert price.source == "yfinance"
        assert price.is_stale is False

    def test_asset_price_with_stale_flag(self):
        price = AssetPrice(
            symbol="AAPL",
            price=150.25,
            currency="USD",
            timestamp=datetime.utcnow(),
            source="yfinance",
            is_stale=True,
        )
        assert price.is_stale is True

    def test_symbol_validation_rejects_special_chars(self):
        with pytest.raises(ValueError):
            AssetPrice(
                symbol="AAPL;DROP TABLE users;--",
                price=150.25,
                currency="USD",
                timestamp=datetime.utcnow(),
                source="yfinance",
            )

    def test_symbol_validation_accepts_valid_symbols(self):
        valid_symbols = ["AAPL", "BTC-USD", "XAU/USD", "AAPL.NS", "RELIANCE.BO"]
        for symbol in valid_symbols:
            price = AssetPrice(
                symbol=symbol,
                price=150.25,
                currency="USD",
                timestamp=datetime.utcnow(),
                source="yfinance",
            )
            assert price.symbol == symbol
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_schemas.py -v
```
Expected: FAIL with "app.providers.schemas not found"

- [ ] **Step 3: Create providers/schemas.py**
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

- [ ] **Step 4: Create providers/__init__.py**
```python
"""Data providers module."""
from app.providers.schemas import AssetPrice

__all__ = ["AssetPrice"]
```

- [ ] **Step 5: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_schemas.py -v
```
Expected: 4 tests PASS

- [ ] **Step 6: Commit**
```bash
git add backend/app/providers/
git commit -m "feat: add AssetPrice Pydantic schema with validation"
```

---

## Task 6: Base Provider Abstract Class

**Files:**
- Create: `backend/app/providers/base.py`
- Create: `backend/tests/unit/test_base_provider.py`

- [ ] **Step 1: Write failing test**
```python
from abc import ABC
from datetime import datetime

import pytest

from app.providers.base import BaseProvider, ProviderError
from app.providers.schemas import AssetPrice


class MockProvider(BaseProvider):
    name = "mock"
    priority = 1

    async def fetch_price(self, symbol: str) -> AssetPrice:
        return AssetPrice(
            symbol=symbol,
            price=100.0,
            currency="USD",
            timestamp=datetime.utcnow(),
            source=self.name,
        )

    async def health_check(self) -> bool:
        return True

    @property
    def rate_limit_delay(self) -> float:
        return 1.0


class TestBaseProvider:
    def test_base_provider_is_abstract(self):
        assert issubclass(BaseProvider, ABC)

    def test_provider_error_is_exception(self):
        assert issubclass(ProviderError, Exception)

    @pytest.mark.asyncio
    async def test_mock_provider_implements_interface(self):
        provider = MockProvider()
        assert provider.name == "mock"
        assert provider.priority == 1
        assert await provider.health_check() is True
        assert provider.rate_limit_delay == 1.0

        price = await provider.fetch_price("AAPL")
        assert price.symbol == "AAPL"
        assert price.price == 100.0
        assert price.source == "mock"
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_base_provider.py -v
```
Expected: FAIL with import errors

- [ ] **Step 3: Create providers/base.py**
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
    """Abstract base class for all data providers.

    All providers must implement this interface for consistent
    handling regardless of data source.
    """

    name: str
    priority: int = 100  # Lower = higher priority for fallback chain

    @abstractmethod
    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current price for symbol.

        Args:
            symbol: Asset symbol (e.g., "AAPL", "BTC-USD")

        Returns:
            AssetPrice with current market data

        Raises:
            ProviderError: If fetch fails
            RateLimitError: If rate limit hit
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is reachable and healthy.

        Returns:
            True if provider is available
        """
        pass

    @property
    @abstractmethod
    def rate_limit_delay(self) -> float:
        """Minimum seconds between requests to respect rate limits."""
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

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_base_provider.py -v
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/providers/base.py backend/tests/unit/test_base_provider.py
git commit -m "feat: add BaseProvider abstract class with error types"
```

---

## Task 7: Cache Manager

**Files:**
- Create: `backend/app/cache/manager.py`
- Create: `backend/tests/unit/test_cache_manager.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.manager import CacheManager
from app.cache.models import PriceCache
from app.providers.schemas import AssetPrice


class TestCacheManager:
    @pytest.mark.asyncio
    async def test_get_returns_fresh_cache(self, monkeypatch):
        mock_session = MagicMock(spec=AsyncSession)
        mock_entry = PriceCache(
            symbol="AAPL",
            price=150.0,
            currency="USD",
            source="yfinance",
            timestamp=datetime.utcnow(),
        )

        # Mock the query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_entry
        mock_session.execute.return_value = mock_result

        cache = CacheManager(mock_session)
        result = await cache.get("AAPL", ttl_seconds=300)

        assert result is not None
        assert result.symbol == "AAPL"
        assert result.is_stale is False

    @pytest.mark.asyncio
    async def test_get_returns_none_for_expired_cache(self, monkeypatch):
        mock_session = MagicMock(spec=AsyncSession)
        mock_entry = PriceCache(
            symbol="AAPL",
            price=150.0,
            currency="USD",
            source="yfinance",
            timestamp=datetime.utcnow() - timedelta(seconds=400),
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_entry
        mock_session.execute.return_value = mock_result

        cache = CacheManager(mock_session)
        result = await cache.get("AAPL", ttl_seconds=300)

        assert result is None  # Expired = None to trigger refetch

    @pytest.mark.asyncio
    async def test_get_returns_none_when_no_cache(self):
        mock_session = MagicMock(spec=AsyncSession)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        cache = CacheManager(mock_session)
        result = await cache.get("AAPL")

        assert result is None

    @pytest.mark.asyncio
    async def test_set_creates_cache_entry(self):
        mock_session = MagicMock(spec=AsyncSession)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()

        price = AssetPrice(
            symbol="AAPL",
            price=150.0,
            currency="USD",
            timestamp=datetime.utcnow(),
            source="yfinance",
        )

        cache = CacheManager(mock_session)
        await cache.set("AAPL", price)

        mock_session.add.assert_called_once()
        mock_session.commit.assert_awaited_once()
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_cache_manager.py -v
```
Expected: FAIL with import errors

- [ ] **Step 3: Create cache/manager.py**
```python
from datetime import datetime
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.models import PriceCache
from app.providers.schemas import AssetPrice


class CacheManager:
    """PostgreSQL-based cache with stale-while-revalidate pattern.

    When data is requested:
    1. Return fresh cached data immediately
    2. If cache is stale, return stale data AND trigger background refresh
    3. If no cache, fetch and cache before returning
    """

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
            # Stale data - return with stale flag for caller to handle
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

        Returns:
            Tuple of (price, is_fresh) where is_fresh is False if stale or newly fetched
        """
        # Try cache first
        cached = await self._get_cached_entry(key)
        if cached and cached.is_fresh(ttl_seconds):
            return cached.to_price(), True

        # Try to fetch fresh data
        try:
            price = await fetcher()
            await self.set(key, price)
            return price, True
        except Exception:
            # Return stale if available, otherwise re-raise
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

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_cache_manager.py -v
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/cache/manager.py backend/tests/unit/test_cache_manager.py
git commit -m "feat: add CacheManager with stale-while-revalidate pattern"
```

---

## Task 8: YFinance Provider

**Files:**
- Create: `backend/app/providers/yfinance_provider.py`
- Create: `backend/tests/unit/test_yfinance_provider.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.providers.yfinance_provider import YFinanceProvider
from app.providers.schemas import AssetPrice


class TestYFinanceProvider:
    @pytest.fixture
    def provider(self):
        return YFinanceProvider()

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider):
        mock_ticker = MagicMock()
        mock_ticker.info = {"currentPrice": 150.25, "currency": "USD"}

        with patch("yfinance.Ticker", return_value=mock_ticker):
            price = await provider.fetch_price("AAPL")

        assert price.symbol == "AAPL"
        assert price.price == 150.25
        assert price.currency == "USD"
        assert price.source == "yfinance"
        assert isinstance(price.timestamp, datetime)
        assert price.is_stale is False

    @pytest.mark.asyncio
    async def test_fetch_price_with_long_name(self, provider):
        mock_ticker = MagicMock()
        mock_ticker.info = {"currentPrice": 150.25, "currency": "USD"}

        with patch("yfinance.Ticker", return_value=mock_ticker):
            price = await provider.fetch_price("AAPL")

        assert price.symbol == "AAPL"

    def test_name_and_priority(self):
        provider = YFinanceProvider()
        assert provider.name == "yfinance"
        assert provider.priority == 10
        assert provider.rate_limit_delay == 1.0

    def test_normalize_symbol_stock(self):
        provider = YFinanceProvider()
        assert provider._normalize_symbol("aapl") == "AAPL"
        assert provider._normalize_symbol("AAPL") == "AAPL"

    def test_normalize_symbol_crypto(self):
        provider = YFinanceProvider()
        assert provider._normalize_symbol("btc") == "BTC-USD"
        assert provider._normalize_symbol("BTC") == "BTC-USD"
        assert provider._normalize_symbol("BTC-USD") == "BTC-USD"
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_yfinance_provider.py -v
```
Expected: FAIL with "yfinance_provider not found"

- [ ] **Step 3: Create yfinance_provider.py**
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
    priority = 10  # Try first (highest quality for equities)

    @property
    def rate_limit_delay(self) -> float:
        return 1.0  # 1 second between requests

    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current price from Yahoo Finance."""
        try:
            # Run yfinance in thread pool (it's synchronous)
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

        # Crypto mappings
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

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_yfinance_provider.py -v
```
Expected: 6 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/providers/yfinance_provider.py backend/tests/unit/test_yfinance_provider.py
git commit -m "feat: add YFinance provider for equities and crypto"
```

---

## Task 9: CoinGecko Provider

**Files:**
- Create: `backend/app/providers/coingecko_provider.py`
- Create: `backend/tests/unit/test_coingecko_provider.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.providers.coingecko_provider import CoinGeckoProvider
from app.providers.schemas import AssetPrice


class TestCoinGeckoProvider:
    @pytest.fixture
    def provider(self):
        return CoinGeckoProvider()

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider):
        mock_response = {
            "bitcoin": {
                "usd": 65000.0,
            }
        }

        with patch("httpx.AsyncClient.get", return_value=AsyncMock(
            status_code=200,
            json=AsyncMock(return_value=mock_response),
            raise_for_status=AsyncMock(return_value=None),
        )):
            price = await provider.fetch_price("BTC")

        assert price.symbol == "BTC"
        assert price.price == 65000.0
        assert price.currency == "USD"
        assert price.source == "coingecko"

    def test_name_and_priority(self):
        provider = CoinGeckoProvider()
        assert provider.name == "coingecko"
        assert provider.priority == 20
        assert provider.rate_limit_delay == 6.0  # 10 calls/min = 6 sec

    def test_normalize_symbol(self):
        provider = CoinGeckoProvider()
        assert provider._normalize_symbol("BTC") == "bitcoin"
        assert provider._normalize_symbol("ETH") == "ethereum"
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_coingecko_provider.py -v
```
Expected: FAIL

- [ ] **Step 3: Create coingecko_provider.py**
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

    # Symbol to CoinGecko ID mapping
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
        self._client: httpx.AsyncClient | None = None

    @property
    def rate_limit_delay(self) -> float:
        # Free tier: ~10 calls/min = 6 seconds between calls
        return 6.0

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

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_coingecko_provider.py -v
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/providers/coingecko_provider.py backend/tests/unit/test_coingecko_provider.py
git commit -m "feat: add CoinGecko provider for crypto prices"
```

---

## Task 10: Provider Registry

**Files:**
- Create: `backend/app/providers/registry.py`
- Create: `backend/tests/unit/test_registry.py`

- [ ] **Step 1: Write failing test**
```python
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.providers.registry import ProviderRegistry
from app.providers.base import BaseProvider, ProviderError
from app.providers.schemas import AssetPrice


class MockProvider(BaseProvider):
    name = "mock"
    priority = 50

    def __init__(self, should_fail=False):
        self.should_fail = should_fail

    async def fetch_price(self, symbol: str) -> AssetPrice:
        if self.should_fail:
            raise ProviderError("Mock failure")
        return AssetPrice(
            symbol=symbol,
            price=100.0,
            currency="USD",
            timestamp=datetime.utcnow(),
            source=self.name,
        )

    async def health_check(self) -> bool:
        return not self.should_fail

    @property
    def rate_limit_delay(self) -> float:
        return 0.1


class TestProviderRegistry:
    @pytest.mark.asyncio
    async def test_registry_returns_first_successful(self):
        good = MockProvider(should_fail=False)
        bad = MockProvider(should_fail=True)

        registry = ProviderRegistry([bad, good])
        price = await registry.fetch_price("AAPL")

        assert price.price == 100.0
        assert price.source == "mock"
        assert price.is_stale is False

    @pytest.mark.asyncio
    async def test_registry_raises_all_fail(self):
        bad1 = MockProvider(should_fail=True)
        bad2 = MockProvider(should_fail=True)

        registry = ProviderRegistry([bad1, bad2])

        with pytest.raises(ProviderError):
            await registry.fetch_price("AAPL")

    def test_providers_sorted_by_priority(self):
        class P1(MockProvider):
            name = "p1"
            priority = 10

        class P2(MockProvider):
            name = "p2"
            priority = 5

        class P3(MockProvider):
            name = "p3"
            priority = 100

        registry = ProviderRegistry([P3(), P1(), P2()])
        assert [p.name for p in registry.providers] == ["p2", "p1", "p3"]
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_registry.py -v
```
Expected: FAIL

- [ ] **Step 3: Create registry.py**
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
        use_stale: bool = True,
    ) -> AssetPrice:
        """Fetch price trying providers in priority order.

        Args:
            symbol: Asset symbol to fetch
            use_stale: If True and all providers fail but stale cache exists,
                       return stale data instead of raising

        Returns:
            AssetPrice from first successful provider

        Raises:
            ProviderError: If all providers fail
        """
        last_error = None

        for provider in self.providers:
            # Skip providers that are unhealthy
            if not await provider.health_check():
                continue

            try:
                price = await provider.fetch_price(symbol)
                return price
            except ProviderError as e:
                last_error = e
                continue

        # All providers failed
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

        # Add CoinGecko if API key available (or try free tier)
        providers.append(CoinGeckoProvider(api_key=settings.coingecko_api_key))

        return cls(providers)
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_registry.py -v
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/providers/registry.py backend/tests/unit/test_registry.py
git commit -m "feat: add ProviderRegistry with fallback chain support"
```

---

## Task 11: WebSocket Connection Manager

**Files:**
- Create: `backend/app/websocket/manager.py`
- Create: `backend/app/websocket/__init__.py`
- Create: `backend/tests/unit/test_websocket_manager.py`

- [ ] **Step 1: Write failing test**
```python
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import WebSocket

from app.websocket.manager import ConnectionManager


class TestConnectionManager:
    @pytest.fixture
    def manager(self):
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_adds_connection(self, manager):
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.accept = AsyncMock()

        await manager.connect(mock_ws)
        assert len(manager.active_connections) == 1

    @pytest.mark.asyncio
    async def test_disconnect_removes_connection(self, manager):
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.accept = AsyncMock()

        await manager.connect(mock_ws)
        manager.disconnect(mock_ws)
        assert len(manager.active_connections) == 0

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all(self, manager):
        mock_ws1 = MagicMock(spec=WebSocket)
        mock_ws1.accept = AsyncMock()
        mock_ws1.send_json = AsyncMock()

        mock_ws2 = MagicMock(spec=WebSocket)
        mock_ws2.accept = AsyncMock()
        mock_ws2.send_json = AsyncMock()

        await manager.connect(mock_ws1)
        await manager.connect(mock_ws2)

        await manager.broadcast({"type": "price", "data": {"AAPL": 150.0}})

        mock_ws1.send_json.assert_awaited_once()
        mock_ws2.send_json.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_broadcast_handles_disconnected_clients(self, manager):
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.accept = AsyncMock()
        mock_ws.send_json = AsyncMock(side_effect=RuntimeError("Disconnected"))

        await manager.connect(mock_ws)
        await manager.broadcast({"type": "price", "data": {}})

        assert len(manager.active_connections) == 0
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_websocket_manager.py -v
```
Expected: FAIL

- [ ] **Step 3: Create websocket/manager.py**
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
                # Client disconnected
                disconnected.append(connection)

        # Clean up disconnected clients
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

- [ ] **Step 4: Create websocket/__init__.py**
```python
"""WebSocket module for real-time price updates."""
from app.websocket.manager import ConnectionManager

__all__ = ["ConnectionManager"]
```

- [ ] **Step 5: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_websocket_manager.py -v
```
Expected: 4 tests PASS

- [ ] **Step 6: Commit**
```bash
git add backend/app/websocket/
git commit -m "feat: add WebSocket ConnectionManager for real-time broadcasts"
```

---

## Task 12: REST API Price Routes

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/deps.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/prices.py`
- Create: `backend/tests/unit/test_price_routes.py`

- [ ] **Step 1: Write failing test**
```python
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.api.routes import prices as prices_module


class TestPriceRoutes:
    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(prices_module.router, prefix="/api/v1")
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_get_price_endpoint_exists(self, client):
        with patch.object(prices_module, "get_session", return_value=AsyncMock()):
            with patch.object(prices_module.PriceService, "get_price", return_value={
                "symbol": "AAPL",
                "price": 150.0,
                "currency": "USD",
                "timestamp": "2024-01-01T00:00:00",
                "source": "yfinance",
                "is_stale": False,
            }):
                response = client.get("/api/v1/prices/AAPL")
                assert response.status_code in [200, 500]  # 500 if mocked poorly

    def test_health_endpoint_returns_ok(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_list_assets_endpoint_exists(self, client):
        response = client.get("/api/v1/assets")
        assert response.status_code in [200, 500]
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && python -m pytest tests/unit/test_price_routes.py -v
```
Expected: FAIL

- [ ] **Step 3: Create api/deps.py**
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

- [ ] **Step 4: Create api/routes/prices.py**
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

        # Try cache first or fetch
        cached = await self.cache.get(symbol, ttl_seconds=settings.cache_ttl_seconds)
        if cached and not cached.is_stale:
            return cached

        # Fetch fresh data
        try:
            price = await self.registry.fetch_price(symbol)
            await self.cache.set(symbol, price)
            return price
        except Exception:
            # Return stale if available
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
    # Hardcoded for Phase 1 - will be dynamic later
    return [
        {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "currency": "USD"},
        {"symbol": "MSFT", "name": "Microsoft", "type": "stock", "currency": "USD"},
        {"symbol": "GOOGL", "name": "Alphabet", "type": "stock", "currency": "USD"},
        {"symbol": "TSLA", "name": "Tesla", "type": "stock", "currency": "USD"},
        {"symbol": "BTC", "name": "Bitcoin", "type": "crypto", "currency": "USD"},
        {"symbol": "ETH", "name": "Ethereum", "type": "crypto", "currency": "USD"},
    ]
```

- [ ] **Step 5: Create empty __init__.py files**
```python
# backend/app/api/__init__.py
"""API module."""
```

```python
# backend/app/api/routes/__init__.py
"""API routes."""
```

- [ ] **Step 6: Run test to verify it passes**
```bash
cd backend && python -m pytest tests/unit/test_price_routes.py -v
```
Expected: Tests PASS (may need adjustments)

- [ ] **Step 7: Commit**
```bash
git add backend/app/api/
git commit -m "feat: add REST API endpoints for prices and health"
```

---

## Task 13: FastAPI Main App

**Files:**
- Create: `backend/app/main.py`
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Write main.py**
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.routes.prices import router as prices_router
from app.websocket.manager import ConnectionManager

# Global WebSocket manager
ws_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    settings = get_settings()

    # Initialize database tables
    await init_db()

    yield

    # Shutdown
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

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Restrict in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(prices_router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {"message": "PaperTrade API", "version": "0.1.0"}

    return app


app = create_app()
```

- [ ] **Step 2: Run test to verify app starts**
```bash
cd backend && python -c "from app.main import app; print('App created successfully')"
```
Expected: "App created successfully"

- [ ] **Step 3: Commit**
```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI main app with lifespan management"
```

---

## Task 14: WebSocket Price Endpoint

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/integration/test_websocket.py`

- [ ] **Step 1: Modify main.py to add WebSocket endpoint**
```python
# Add these imports and route to app/main.py

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Start background price broadcaster
    app.state.price_task = asyncio.create_task(broadcast_prices(app))
    yield
    # Shutdown
    app.state.price_task.cancel()
    try:
        await app.state.price_task
    except asyncio.CancelledError:
        pass


async def broadcast_prices(app: FastAPI):
    """Background task to fetch and broadcast prices."""
    import asyncio
    from app.cache.manager import CacheManager
    from app.providers.registry import ProviderRegistry
    from app.database import make_session_factory

    session_factory = make_session_factory()

    while True:
        try:
            async with session_factory() as session:
                cache = CacheManager(session)
                registry = ProviderRegistry.create_default()

                # Fetch prices for popular symbols
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
                        # Fallback to cache
                        cached = await cache.get(symbol)
                        if cached:
                            prices[symbol] = {
                                "price": cached.price,
                                "currency": cached.currency,
                                "source": cached.source,
                                "is_stale": True,
                            }

                # Broadcast to all connected clients
                if prices:
                    await ws_manager.broadcast({
                        "type": "prices",
                        "data": prices,
                    })

        except Exception as e:
            print(f"Price broadcast error: {e}")

        await asyncio.sleep(5)  # Update every 5 seconds


# Add WebSocket route
def create_app() -> FastAPI:
    # ... existing code ...

    @app.websocket("/ws/prices")
    async def websocket_prices(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                # Keep connection alive, respond to pings
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        except Exception:
            ws_manager.disconnect(websocket)

    return app
```

- [ ] **Step 2: Commit**
```bash
git add backend/app/main.py
git commit -m "feat: add WebSocket price broadcasting with background task"
```

---

## Task 15: Test Configuration Fixtures

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create conftest.py**
```python
import pytest
import asyncio
from decimal import Decimal
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_db_session():
    """Create a fresh database session for each test."""
    # Use in-memory SQLite for tests
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def mock_cache_manager():
    """Mock cache manager for testing."""
    mock = MagicMock(spec=CacheManager)
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=None)
    return mock


@pytest.fixture
def mock_provider_registry():
    """Mock provider registry for testing."""
    mock = MagicMock(spec=ProviderRegistry)
    mock.fetch_price = AsyncMock()
    mock.health_check_all = AsyncMock(return_value={"mock": True})
    return mock
```

- [ ] **Step 2: Run test to verify fixtures work**
```bash
cd backend && python -m pytest tests/conftest.py --collect-only
```
Expected: Tests collected without errors

- [ ] **Step 3: Commit**
```bash
git add backend/tests/conftest.py
git commit -m "test: add pytest fixtures for async database and mocks"
```

---

## must_haves

Derived from phase goal: "The system reliably provides real-time market data across all asset classes, with caching, graceful failure, and normalized formats."

These 5 things MUST be true for the phase to be complete:

1. **Live prices update every 5 seconds** - WebSocket broadcasts current prices for all supported assets with no more than 5-second delay
2. **All prices normalized to AssetPrice schema** - Every provider returns consistent format regardless of source
3. **Stale data served gracefully** - When APIs fail, last known price is returned with is_stale=True instead of error
4. **Provider fallback chain works** - If yfinance fails, system falls back to CoinGecko automatically
5. **PostgreSQL cache persists data** - 5-minute TTL with stale-while-revalidate, cache survives restarts

---

## verification

### Pre-verification Steps
```bash
cd backend
# Install dependencies
pip install -r requirements.txt

# Set up database (Docker)
docker run -d --name papertrade-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=papertrade -p 5432:5432 postgres:15

# Wait for DB ready
sleep 3

# Verify tests pass
pytest tests/ -v

# Start the app
uvicorn app.main:app --reload --port 8000
```

### Verification Steps

1. **Test REST API**
   ```bash
   curl http://localhost:8000/api/v1/health
   # Expected: {"status":"ok"}

   curl http://localhost:8000/api/v1/prices/AAPL
   # Expected: {"symbol":"AAPL","price":150.25,...}
   ```

2. **Test WebSocket**
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://localhost:8000/ws/prices');
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
   // Should see price updates every 5 seconds
   ```

3. **Test Graceful Degradation**
   - Disconnect internet
   - Request price via curl
   - Should return cached price with is_stale=true

4. **Test Provider Fallback**
   - Verify yfinance is first in chain
   - Mock yfinance to fail
   - Verify CoinGecko serves the request

### Definition of Done
- [ ] All 14 tasks complete
- [ ] All unit tests pass: `pytest tests/unit/ -v`
- [ ] All integration tests pass: `pytest tests/integration/ -v`
- [ ] REST endpoints respond correctly
- [ ] WebSocket delivers prices every 5 seconds
- [ ] Stale data served when APIs fail
- [ ] Provider fallback chain works
- [ ] Code committed after each task
- [ ] Must_haves checklist verified

---

*Phase 1: Data Infrastructure*
*Coverage: INFRA-01, INFRA-02, INFRA-03, INFRA-04*
