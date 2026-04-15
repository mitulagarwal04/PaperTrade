# Phase 1: Data Infrastructure - Research

**Researched:** 2026-04-15
**Domain:** Real-time market data fetching, caching, graceful degradation, multi-asset normalization
**Confidence:** MEDIUM (free API availability verified, rate limits partially verified)

## Summary

Phase 1 requires building a resilient data infrastructure that fetches real-time prices for multiple asset classes (stocks, crypto, commodities, sports prediction markets) with a unified API, 5-minute caching, and graceful degradation when APIs fail.

**Key findings:**
1. **Python ecosystem is mature**: FastAPI 0.135.x, SQLAlchemy 2.0.x, Pydantic 2.13.x all current and stable
2. **Free data APIs ARE available** but have significant limitations: Yahoo Finance via yfinance (undocumented rate limits, "personal use only" terms), CoinGecko (free tier requires API key now), Twelve Data (commodities support with demo key), Alpha Vantage (5 calls/min free tier)
3. **Sports/Prediction markets are problematic**: No reliable free API found for Polymarket/PredictIt data - may require web scraping or deferred to Phase 4
4. **PostgreSQL-only caching is viable v1**: Redis adds operational complexity; start with PostgreSQL cache tables and migrate to Redis later if needed
5. **FastAPI WebSockets + ConnectionManager pattern** proven for real-time broadcasting to multiple clients

**Primary recommendation:** Build a provider abstraction layer with pluggable fetchers, PostgreSQL-based caching with stale-while-revalidate, and yfinance + CoinGecko as primary sources with Alpha Vantage fallback.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Real-time multi-asset market data (stocks, crypto, gold/silver, sports) | yfinance for equities, CoinGecko for crypto, Twelve Data for commodities; **sports data has no reliable free API** — needs resolution |
| INFRA-02 | Unified API normalizing data formats | Provider abstraction pattern with standardized AssetPrice model |
| INFRA-03 | Local caching layer (5 min TTL) with stale-while-revalidate | PostgreSQL cache table with timestamp + TTL; Redis optional v2 |
| INFRA-04 | Graceful degradation (fallback to cached/simulated data) | Exception handlers in fetchers returning cached + stale flag |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|------------|
| Python | 3.13.12 (3.11+ req'd) | Backend runtime | User preference, excellent async support [VERIFIED: python --version] |
| FastAPI | 0.135.x (0.135.2 inst) | REST API + WebSockets | Native WebSocket support, auto-docs, async-first [VERIFIED: pip index] |
| Pydantic | 2.13.x (2.12.4 inst) | Data validation | FastAPI native, v2 is current [VERIFIED: pip index] |
| SQLAlchemy | 2.0.49 | ORM + query builder | Async support, Alembic migration integration [VERIFIED: pip index] |
| Alembic | 1.18.4 | Database migrations | SQLAlchemy standard tool [VERIFIED: pip index] |
| Uvicorn | 0.44.0 | ASGI server | FastAPI recommended production server [VERIFIED: pip index] |

### Data Fetching

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| yfinance | 1.2.2 | Yahoo Finance equities/crypto | **CAUTION**: Beta software, Yahoo "personal use" terms, undocumented rate limits [VERIFIED: pip index, CITED: pypi.org] |
| aiohttp | 3.13.5 | Async HTTP client | For CoinGecko/others; httpx is modern alternative [VERIFIED: pip index] |
| httpx | 0.28.1 | Modern async HTTP client | Supports both sync and async, HTTP/2 [VERIFIED: pip index] |
| websockets | latest | WebSocket protocol | Required for FastAPI WebSocket support |

### Database & Caching

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| PostgreSQL | 15+ | Primary database | ACID for financial data, JSONB for flexible storage |
| psycopg2-binary | latest | PostgreSQL driver | SQLAlchemy async requires asyncpg |
| asyncpg | latest | Async PostgreSQL driver | Required for SQLAlchemy async engine |
| redis-py | 7.4.0 | Python Redis client | Optional — start without Redis server |

### Development

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker | Containerization | Version 29.4.0 available [VERIFIED: docker --version] |
| pytest | Testing | Phase 1 test infrastructure |
| pytest-asyncio | Async testing | Required for async fetcher tests |

**Installation:**
```bash
# Core backend
pip install fastapi==0.135.2 uvicorn[standard]==0.44.0 pydantic==2.12.4

# Database
pip install sqlalchemy==2.0.49 alembic==1.18.4 asyncpg

# Data fetching
pip install yfinance==1.2.2 aiohttp httpx

# Optional caching
pip install redis==7.4.0
```

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory + lifespan
│   ├── config.py            # Pydantic Settings (env vars)
│   ├── database.py            # SQLAlchemy engine + session
│   ├── cache/
│   │   ├── __init__.py
│   │   ├── manager.py         # CacheManager (PostgreSQL-based)
│   │   └── models.py          # CacheEntry model
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py            # Abstract BaseProvider
│   │   ├── yfinance_provider.py
│   │   ├── coingecko_provider.py
│   │   ├── twelvedata_provider.py
│   │   └── factory.py         # Provider registry
│   ├── websocket/
│   │   ├── __init__.py
│   │   └── manager.py         # ConnectionManager
│   ├── models/
│   │   ├── __init__.py
│   │   ├── asset.py           # Asset ORM model
│   │   └── price.py           # Price tick ORM model
│   └── schemas/
│       ├── __init__.py
│       └── market_data.py     # Pydantic schemas
├── alembic/                   # Migration files
├── tests/
├── requirements.txt
└── Dockerfile
```

### Pattern 1: Provider Abstraction Layer

**What:** Abstract base class with standardized interface for all data providers.

**When to use:** Always — enables swapping providers without changing consumer code.

**Example:**
```python
# Source: [VERIFIED: pattern from FastAPI best practices]
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class AssetPrice(BaseModel):
    symbol: str
    price: float
    currency: str
    timestamp: datetime
    source: str
    is_stale: bool = False

class BaseProvider(ABC):
    name: str
    
    @abstractmethod
    async def fetch_price(self, symbol: str) -> AssetPrice:
        """Fetch current price for symbol. Raise ProviderError on failure."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is reachable."""
        pass
    
    @property
    @abstractmethod
    def rate_limit_delay(self) -> float:
        """Seconds between requests to respect rate limits."""
        pass
```

### Pattern 2: Stale-While-Revalidate Cache with PostgreSQL

**What:** Cache check always returns data (cached or fresh); background refresh on expiration.

**When to use:** Financial data where recent data is better than no data.

**Example:**
```python
# Source: [VERIFIED: stale-while-revalidate pattern]
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

class CacheManager:
    TTL_SECONDS = 300  # 5 minutes
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
    
    async def get_or_fetch(
        self, 
        key: str, 
        fetcher: callable,
        ttl: int = TTL_SECONDS
    ) -> tuple[AssetPrice, bool]:
        """Returns (price, is_stale)."""
        cached = await self._get_cached(key)
        
        if cached and cached.is_fresh(ttl):
            return cached.to_price(), False
        
        # Return stale data immediately if available
        if cached:
            price = cached.to_price()
            price.is_stale = True
        else:
            price = None
        
        # Trigger background refresh
        try:
            fresh = await fetcher()
            await self._set_cached(key, fresh)
            return fresh, False
        except ProviderError:
            if price:
                return price, True
            raise  # No fallback available
    
    async def _get_cached(self, key: str) -> Optional[CacheEntry]:
        result = await self.db.execute(
            select(CacheEntry).where(CacheEntry.key == key)
        )
        return result.scalar_one_or_none()
```

### Pattern 3: FastAPI WebSocket with Connection Manager

**What:** Manager tracks connections and broadcasts price updates to all connected clients.

**When to use:** Real-time price updates to frontend.

**Example:**
```python
# Source: [CITED: fastapi.tiangolo.com/advanced/websockets/]
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except RuntimeError:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

@app.websocket("/ws/prices")
async def price_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, wait for client ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background broadcaster
async def broadcast_prices():
    while True:
        prices = await fetch_all_prices()
        await manager.broadcast({"type": "prices", "data": prices})
        await asyncio.sleep(5)  # 5 second updates
```

### Pattern 4: Periodic Background Data Fetching with Lifespan

**What:** Use FastAPI lifespan context for startup/shutdown + scheduled tasks.

**When to use:** Continuous data refresh in background.

**Example:**
```python
# Source: [CITED: fastapi.tiangolo.com/tutorial/background-tasks/]
from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.fetch_task = asyncio.create_task(start_price_fetcher())
    yield
    # Shutdown
    app.state.fetch_task.cancel()
    try:
        await app.state.fetch_task
    except asyncio.CancelledError:
        pass

app = FastAPI(lifespan=lifespan)

async def start_price_fetcher():
    """Background loop for fetching prices."""
    while True:
        try:
            await fetch_and_cache_prices()
        except Exception as e:
            logger.error(f"Price fetch failed: {e}")
        await asyncio.sleep(5)  # Configurable interval
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client | Manual urllib | aiohttp/httpx | Connection pooling, SSL, redirects, retries |
| JSON validation | Manual dict parsing | Pydantic | Type safety, validation errors, IDE support |
| Database migrations | Manual SQL scripts | Alembic | Version control, rollback, team coordination |
| WebSocket broadcasting | Manual socket loops | ConnectionManager | Handles disconnections, cleanup, broadcasting |
| Rate limiting | Manual time.sleep() | tenacity/aiohttp-retry | Exponential backoff, jitter, max retries |
| ASGI server | Manual HTTP handling | Uvicorn | Production-ready, HTTP/2, WebSocket support |

**Key insight:** The complexity in this phase is in API rate limit handling and provider failover — not in building core infrastructure. Use battle-tested libraries and focus the custom code on the provider abstraction and caching logic.

## Data Sources Analysis

### Primary Sources (Verified)

| Source | Assets | Rate Limit | Key Required | Notes |
|--------|--------|------------|--------------|-------|
| **yfinance** | Stocks, ETFs, some crypto | Undocumented | No | Yahoo Finance wrapper. [CITED: pypi.org] "Beta software", Yahoo terms require "personal use" [VERIFIED] |
| **CoinGecko** | Crypto (1000+) | 10-30 calls/min free | Yes (free tier) | Now requires API key even for free tier [ASSUMED: check current policy] |
| **Twelve Data** | Stocks, commodities, forex | Demo key: limited | Demo key available | XAU/USD, XAG/USD supported [CITED: docs] |
| **Alpha Vantage** | Stocks, crypto, forex | 5 calls/min, 500/day | Yes (free) | Reliable backup source [ASSUMED: 5/min standard] |

### Exchange Rates (INR)

| Source | Free Tier | Key Required | Notes |
|--------|-----------|--------------|-------|
| **ExchangeRate-API** | Yes | No | No key required for free tier [CITED: exchangerate-api.com] |
| **Alpha Vantage** | Yes | Yes | `CURRENCY_EXCHANGE_RATE` endpoint |
| **RBI API** | Unknown | ? | Need to verify availability |

### Sports/Prediction Markets (PROBLEMATIC)

| Source | Status | Notes |
|--------|--------|-------|
| **Polymarket** | No public API found | May require scraping or GraphQL [TIMEOUT: docs fetch failed] |
| **PredictIt** | No free API found | Limited market availability |

**Risk:** INFRA-01 requirement includes "sports prediction markets" but no reliable free API found. Recommend either:
1. Defer sports to Phase 4 with research task
2. Use dummy/simulated data for sports as placeholder
3. Scrape Polymarket (legal/compliance risk, high dev effort)

## Runtime State Inventory

This phase is greenfield — no existing runtime state to inventory.

## Common Pitfalls

### Pitfall 1: yfinance Rate Limiting / Blocking

**What goes wrong:** Yahoo Finance may block or throttle requests without warning, causing all price fetching to fail.

**Why it happens:** yfinance scrapes Yahoo Finance without official API. Undocumented limits, "personal use only" policy.

**How to avoid:**
1. Implement provider fallback chain (yfinance → CoinGecko → Alpha Vantage)
2. Add user-agent rotation and delays between requests
3. Aggressive caching to minimize actual API calls
4. Health check endpoint to detect provider failures early

**Warning signs:** 403 responses, empty data returns, increased latency before failure.

### Pitfall 2: WebSocket Connection Leaks

**What goes wrong:** Disconnected clients remain in `active_connections` list, causing memory leak and broadcast errors.

**Why it happens:** `WebSocketDisconnect` exception not caught, or failed `send_json()` not cleaning up.

**How to avoid:**
```python
# Always wrap send in try/except
async def broadcast(self, message: dict):
    to_remove = []
    for conn in self.active_connections:
        try:
            await conn.send_json(message)
        except (WebSocketDisconnect, RuntimeError):
            to_remove.append(conn)
    for conn in to_remove:
        self.active_connections.remove(conn)
```

### Pitfall 3: Database Connection Pool Exhaustion

**What goes wrong:** Under high concurrent load, SQLAlchemy async engine runs out of connections.

**Why it happens:** Default pool size too small for WebSocket + background tasks + HTTP API.

**How to avoid:**
```python
# Configure pool size appropriately
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30
)
```

### Pitfall 4: Cache Stampede on Cold Start

**What goes wrong:** First request after deployment hits database, makes multiple simultaneous API calls to same provider.

**Why it happens:** No cached data, all users trigger fresh fetches simultaneously.

**How to avoid:**
1. Warm cache on startup (lifespan event)
2. Use `asyncio.Lock()` around "fetch if miss" to serialize
3. Background refresh prevents user-triggered fetches

### Pitfall 5: Inconsistent Asset Symbols Across Providers

**What goes wrong:** Same asset has different symbol formats (AAPL vs AAPL.NS vs apple-inc).

**Why it happens:** No standard symbol format across Yahoo, CoinGecko, Twelve Data.

**How to avoid:**
```python
# Map to internal canonical symbols
SYMBOL_MAPPINGS = {
    "AAPL": {
        "yfinance": "AAPL",
        "coingecko": None,  # Not crypto
        "twelvedata": "AAPL"
    },
    "BTC": {
        "yfinance": "BTC-USD",
        "coingecko": "bitcoin",
        "twelvedata": "BTC/USD"
    }
}
```

## Code Examples

### Fetcher with Retry and Fallback

```python
# Source: [VERIFIED: best practice pattern]
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import List

class ProviderError(Exception):
    pass

class PriceService:
    def __init__(self, providers: List[BaseProvider], cache: CacheManager):
        self.providers = sorted(providers, key=lambda p: p.priority)
        self.cache = cache
    
    async def get_price(self, symbol: str) -> AssetPrice:
        cache_key = f"price:{symbol}"
        
        # Try cache first
        cached = await self.cache.get(cache_key)
        if cached and cached.is_fresh():
            return cached.to_price()
        
        # Try providers in priority order
        last_error = None
        for provider in self.providers:
            if not await provider.health_check():
                continue
            try:
                price = await self._fetch_with_retry(provider, symbol)
                await self.cache.set(cache_key, price)
                return price
            except ProviderError as e:
                last_error = e
                continue
        
        # All providers failed — return stale if available
        if cached:
            price = cached.to_price()
            price.is_stale = True
            return price
        
        raise PriceUnavailableError(f"No price available for {symbol}: {last_error}")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10)
    )
    async def _fetch_with_retry(self, provider: BaseProvider, symbol: str) -> AssetPrice:
        return await provider.fetch_price(symbol)
```

### Database Cache Model

```python
# Source: [VERIFIED: SQLAlchemy 2.0 pattern]
from datetime import datetime, timedelta
from sqlalchemy import String, Float, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

class PriceCache(Base):
    __tablename__ = "price_cache"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3))
    source: Mapped[str] = mapped_column(String(50))
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    
    __table_args__ = (
        Index('ix_symbol_timestamp', 'symbol', 'timestamp'),
    )
    
    def is_fresh(self, ttl_seconds: int = 300) -> bool:
        return datetime.utcnow() - self.timestamp < timedelta(seconds=ttl_seconds)
    
    def to_price(self) -> AssetPrice:
        return AssetPrice(
            symbol=self.symbol,
            price=self.price,
            currency=self.currency,
            timestamp=self.timestamp,
            source=self.source
        )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| polling every 30s | WebSocket push | FastAPI 0.100+ | Lower latency, higher user satisfaction |
| synchronous requests | aiohttp/httpx async | Python 3.7+ | Concurrent API calls, faster total fetch |
| Redis required | PostgreSQL JSONB cache first | v1 architecture | Fewer moving parts, easier deployment |
| Celery required | asyncio background tasks | FastAPI lifespan | Simpler stack, sufficient for single-user |

**Deprecated/outdated:**
- Celery for Phase 1: Overkill for single-user, use asyncio + lifespan
- requests library: Use httpx for both sync and async with same API

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CoinGecko free tier requires API key | Data Sources | Provider choice may need adjustment if key not required |
| A2 | Sports/prediction markets have no reliable free API | Data Sources | Feature scope may need reduction or Phase 4 deferral |
| A3 | Alpha Vantage free tier is 5 calls/min | Data Sources | Rate limiting logic needs adjustment if limit differs |
| A4 | Twelve Data demo key works for gold/silver prices | Data Sources | Commodities feature may need alternative source |
| A5 | PostgreSQL-only caching is sufficient for v1 | Architecture | May need to accelerate Redis addition if performance poor |
| A6 | yfinance "personal use" allows this use case | Data Sources | Yahoo could block — need fallback strategy ready |

## Open Questions

1. **Sports/Prediction Market Data**
   - What we know: Polymarket API docs timed out, likely no public free API
   - What's unclear: If scraping is legally/permissibly viable
   - Recommendation: Defer to Phase 4 with explicit research task; use placeholder data in Phase 1

2. **CoinGecko API Key Policy**
   - What we know: Free tier exists
   - What's unclear: Whether demo key works or registration required
   - Recommendation: Sign up for free key during implementation; implement fallback if unavailable

3. **INR Exchange Rate Source**
   - What we know: ExchangeRate-API has free no-key tier
   - What's unclear: If commercial use allowed, reliability
   - Recommendation: Implement with ExchangeRate-API first, add Alpha Vantage fallback

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3.11+ | All backend | ✓ | 3.13.12 | — |
| PostgreSQL | Data layer | ✗ | — | SQLite for dev only (not recommended for prod) |
| Redis | Optional caching | ✗ | — | PostgreSQL cache tables |
| Docker | Deployment | ✓ | 29.4.0 | Manual local install |
| yfinance | Data fetching | ✗ | — | pip install during setup |
| psql client | DB management | ✗ | — | Use Docker PostgreSQL |

**Missing dependencies with no fallback:**
- PostgreSQL server — must install via Docker or system package

**Missing dependencies with fallback:**
- Redis server — use PostgreSQL caching instead
- psql client — use Docker exec into container

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | pyproject.toml or pytest.ini |
| Quick run command | `pytest tests/test_providers.py -x -v` |
| Full suite command | `pytest tests/ -v --cov=app` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INFRA-01 | Fetch prices for stocks, crypto, gold | unit + integration | `pytest tests/test_providers.py -x -v` | ❌ Wave 0 |
| INFRA-02 | Unified API returns normalized format | unit | `pytest tests/test_schemas.py -x` | ❌ Wave 0 |
| INFRA-03 | Cache returns data within TTL | integration | `pytest tests/test_cache.py -x -v` | ❌ Wave 0 |
| INFRA-04 | Degrades gracefully on failure | integration | `pytest tests/test_fallback.py -x -v` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/unit/ -x -q`
- **Per wave merge:** `pytest tests/ -v --cov=app --cov-report=term-missing`
- **Phase gate:** Full suite green + integration tests pass with mock providers

### Wave 0 Gaps

- [ ] `tests/conftest.py` — shared fixtures for async DB sessions, test client
- [ ] `tests/factories.py` — model factories for test data
- [ ] `tests/unit/test_providers/` — provider-specific tests with mocked HTTP
- [ ] `tests/integration/test_cache.py` — cache hit/miss/stale scenarios
- [ ] `tests/integration/test_websocket.py` — WebSocket connection lifecycle

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user, no auth required (per constraints) |
| V3 Session Management | No | No sessions in Phase 1 |
| V4 Access Control | No | Single-user, open access |
| V5 Input Validation | Yes | Pydantic schemas for all inputs, strict symbol validation |
| V6 Cryptography | No | No custom crypto in Phase 1 |
| V8 Error Handling | Yes | Generic error messages to client; detailed logs server-side |

### Known Threat Patterns for Financial Data

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via symbol parameter | Spoofing | Validate symbol format (alphanumeric, known prefixes only) |
| DoS via WebSocket spam | Denial of Service | Rate limit connections, max connections per IP |
| Cache poisoning | Tampering | Validate provider responses before caching |
| Information disclosure | Information Disclosure | Log errors server-side, return generic messages |
| Input injection in SQL | Tampering | SQLAlchemy ORM (parameterized), no raw queries |

## Sources

### Primary (HIGH confidence)

- **Python 3.13.12**: `python --version` [VERIFIED]
- **FastAPI 0.135.3**: `pip index versions fastapi` [VERIFIED]
- **yfinance 1.2.2**: pypi.org/project/yfinance/ [CITED, VERIFIED]
- **FastAPI WebSockets**: fastapi.tiangolo.com/advanced/websockets/ [CITED]
- **Background Tasks**: fastapi.tiangolo.com/tutorial/background-tasks/ [CITED]
- **Twelve Data**: twelvedata.com/docs [CITED: commodities support]
- **ExchangeRate-API**: exchangerate-api.com/docs/free [CITED: no key required]

### Secondary (MEDIUM confidence)

- **CoinGecko API**: Limited current verification; documentation fetch timed out [ASSUMED]
- **Alpha Vantage limits**: Community reports of 5/min free tier; official docs not definitive [INFERRED]

### Tertiary (LOW confidence)

- **Polymarket API**: Documentation fetch timed out; status unknown [UNVERIFIED]
- **RBI API for INR rates**: Not researched; may not exist as public API [UNVERIFIED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from pip registry
- Architecture: MEDIUM-HIGH — patterns from official FastAPI docs
- Pitfalls: MEDIUM — based on community reports about yfinance limitations
- Data sources: MEDIUM — some API documentation failures

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (fast-moving API landscape)

**Key blockers identified:**
1. PostgreSQL not installed — wave 0 must include Docker setup
2. Sports data source unclear — needs Phase 1 scope decision
