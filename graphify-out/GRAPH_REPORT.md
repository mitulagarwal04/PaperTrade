# Graph Report - .  (2026-04-21)

## Corpus Check
- Corpus is ~9,973 words - fits in a single context window. You may not need a graph.

## Summary
- 187 nodes · 301 edges · 18 communities detected
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.5)
- Token cost: 2,000 input · 2,550 output

## God Nodes (most connected - your core abstractions)
1. `AssetPrice` - 47 edges
2. `BaseProvider` - 23 edges
3. `ProviderError` - 21 edges
4. `CacheManager` - 18 edges
5. `ProviderRegistry` - 18 edges
6. `CoinGeckoProvider` - 16 edges
7. `YFinanceProvider` - 15 edges
8. `PriceCache` - 12 edges
9. `ConnectionManager` - 10 edges
10. `RateLimitError` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Create event loop for async tests.` --uses--> `Base`  [INFERRED]
  backend/tests/conftest.py → backend/app/database.py
- `Create a fresh database session for each test.` --uses--> `Base`  [INFERRED]
  backend/tests/conftest.py → backend/app/database.py
- `PriceCache` --uses--> `Base`  [INFERRED]
  backend/app/cache/models.py → backend/app/database.py
- `Background task to fetch and broadcast prices.` --uses--> `CacheManager`  [INFERRED]
  backend/app/main.py → backend/app/cache/manager.py
- `Background task to fetch and broadcast prices.` --uses--> `ProviderRegistry`  [INFERRED]
  backend/app/main.py → backend/app/providers/registry.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (32): BaseProvider, ProviderError, RateLimitError, Raised when rate limit is hit., Abstract base class for all data providers., Fetch current price for symbol., Check if provider is reachable and healthy., Seconds between requests to respect rate limits. (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (21): AI/ML & Signals, Alternatives Considered, API Keys (all have free tiers), Backend, Backend Core, Constraints, Conventions, Data Sources (Free APIs) (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (14): async_db_session(), event_loop(), Create event loop for async tests., Create a fresh database session for each test., Base, get_session(), init_db(), make_session_factory() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (10): Data providers module., broadcast_prices(), lifespan(), Background task to fetch and broadcast prices., Application lifespan context manager., ConnectionManager, Accept and register a new connection., Broadcast message to all connected clients.          Returns:             Number (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (18): API Endpoints, API will be available at http://localhost:8000, Architecture, Clone the repo, Configure environment, Docs at http://localhost:8000/docs, Edit .env with your database URL and optional API keys, Features (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (10): get_price(), health_check(), list_assets(), PriceService, Service for fetching prices with caching and fallback., Get price for symbol, using cache or fetching fresh., Get current price for an asset., API health check endpoint. (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.23
Nodes (7): CacheManager, PostgreSQL-based cache with stale-while-revalidate pattern., Get cached price. Returns None if expired or missing., Get from cache or fetch if missing/expired.         Returns: (price, is_fresh), Store price in cache., Get most recent cache entry for symbol., PriceCache

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): Core, Data fetching, Database, File Structure, Phase 1: Data Infrastructure Implementation Plan, Task 1: Project Setup and Dependencies, Testing, Utils

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (1): ABC

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): BaseSettings, get_settings(), Settings

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (2): get_db(), Dependency to get database session.

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): Return copy with stale flag set.

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): Validate symbol format - alphanumeric with limited special chars.

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): Ensure currency is 3-letter code.

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **63 isolated node(s):** `Create and return an async session factory.`, `Get a database session. Factory is lazily initialized.`, `Initialize database tables.`, `Get from cache or fetch if missing/expired.         Returns: (price, is_fresh)`, `Dependency to get database session.` (+58 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (2 nodes): `yfinance_provider.py`, `rate_limit_delay()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `.with_stale_flag()`, `Return copy with stale flag set.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `coingecko_provider.py`, `rate_limit_delay()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `Validate symbol format - alphanumeric with limited special chars.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `Ensure currency is 3-letter code.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `requirements.txt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AssetPrice` connect `Community 0` to `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `Base` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `PriceCache` connect `Community 6` to `Community 8`, `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `AssetPrice` (e.g. with `PriceCache` and `Check if cache entry is within TTL.`) actually correct?**
  _`AssetPrice` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `BaseProvider` (e.g. with `YFinanceProvider` and `Yahoo Finance data provider via yfinance library.      Supports stocks, ETFs, in`) actually correct?**
  _`BaseProvider` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `ProviderError` (e.g. with `YFinanceProvider` and `Yahoo Finance data provider via yfinance library.      Supports stocks, ETFs, in`) actually correct?**
  _`ProviderError` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `CacheManager` (e.g. with `Background task to fetch and broadcast prices.` and `Application lifespan context manager.`) actually correct?**
  _`CacheManager` has 10 INFERRED edges - model-reasoned connections that need verification._