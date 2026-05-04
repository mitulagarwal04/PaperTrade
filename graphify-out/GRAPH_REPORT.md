# Graph Report - .  (2026-05-01)

## Corpus Check
- Corpus is ~32,449 words - fits in a single context window. You may not need a graph.

## Summary
- 528 nodes · 1568 edges · 18 communities detected
- Extraction: 46% EXTRACTED · 54% INFERRED · 0% AMBIGUOUS · INFERRED: 839 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `OrderSide` - 95 edges
2. `Order` - 82 edges
3. `TradeFill` - 80 edges
4. `OrderType` - 72 edges
5. `UserCash` - 65 edges
6. `OrderStatus` - 64 edges
7. `AssetPrice` - 59 edges
8. `PortfolioService` - 57 edges
9. `OrderService` - 54 edges
10. `ProviderRegistry` - 50 edges

## Surprising Connections (you probably didn't know these)
- `Graph Report` --references--> `PaperTrade Project`  [INFERRED]
  graphify-out/GRAPH_REPORT.md → CLAUDE.md
- `Provider Abstraction Pattern` --realized_by--> `BaseProvider (Abstract Class)`  [INFERRED]
  README.md → docs/superpowers/plans/2026-04-15-phase-1-data-infrastructure.md
- `Provider Fallback Chain` --realized_by--> `ProviderRegistry`  [INFERRED]
  README.md → docs/superpowers/plans/2026-04-15-phase-1-data-infrastructure.md
- `Stale-While-Revalidate Pattern` --realized_by--> `CacheManager`  [INFERRED]
  README.md → docs/superpowers/plans/2026-04-15-phase-1-data-infrastructure.md
- `Graceful Degradation Pattern` --realized_by--> `PriceService`  [INFERRED]
  README.md → docs/superpowers/plans/2026-04-15-phase-1-data-infrastructure.md

## Communities

### Community 0 - "Execution & Order Management"
Cohesion: 0.07
Nodes (81): Enum, ExecutionService, Execution service with simulated slippage and latency., Handles order execution with simulated market conditions., Execute a limit order if conditions are met.          Args:             order: T, Initialize execution service.          Args:             provider_registry: Regi, Check if stop order trigger condition is met.          Stop-loss:         - BUY:, Execute a stop order that has been triggered.          Stop orders execute at ma (+73 more)

### Community 1 - "Backend Core Models"
Cohesion: 0.06
Nodes (76): BaseModel, PaperTrade API main application., Background task to fetch and broadcast prices., Background task to check and fill conditional orders., Application lifespan context manager., CacheManager, get_portfolio(), get_positions() (+68 more)

### Community 2 - "API Layer"
Cohesion: 0.04
Nodes (10): ApiError, broadcast_prices(), check_orders(), lifespan(), React, addToRemoveQueue(), dispatch(), genId() (+2 more)

### Community 3 - "External Data Sources"
Cohesion: 0.06
Nodes (58): aiohttp, aiosqlite, Alembic, Alpha Vantage Data Source, AssetPrice Schema, asyncpg, BaseProvider (Abstract Class), broadcast_prices Back ground Task (+50 more)

### Community 4 - "Provider Abstraction"
Cohesion: 0.06
Nodes (38): ABC, BaseProvider, ProviderError, RateLimitError, Raised when rate limit is hit., Abstract base class for all data providers., Fetch current price for symbol., Check if provider is reachable and healthy. (+30 more)

### Community 5 - "Test Infrastructure"
Cohesion: 0.05
Nodes (34): event_loop(), Test configuration and fixtures., Create event loop for async tests., Create a fresh database session for each test., Create test user cash., session(), user_cash(), Base (+26 more)

### Community 6 - "WebSocket & Real-time"
Cohesion: 0.2
Nodes (6): Data providers module., ConnectionManager, Accept and register a new connection., Broadcast message to all connected clients.          Returns:             Number, Send message to specific client., WebSocket connection manager.      Tracks active connections and broadcasts mess

### Community 7 - "Coverage Report"
Cohesion: 0.29
Nodes (2): getCellValue(), rowComparator()

### Community 8 - "Price Debugging"
Cohesion: 0.4
Nodes (4): Test AAPL as comparison., Test yfinance directly., test_aapl(), test_yfinance_direct()

### Community 9 - "Application Config"
Cohesion: 0.67
Nodes (3): BaseSettings, get_settings(), Settings

### Community 10 - "Frontend Build"
Cohesion: 1.0
Nodes (3): PaperTrade Frontend Application, Vite Build Tool, Vite Logo (SVG)

### Community 11 - "Linting Config"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Vite Environment"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Schema Rationale"
Cohesion: 1.0
Nodes (1): Validate symbol format - alphanumeric with limited special chars.

### Community 15 - "Schema Rationale"
Cohesion: 1.0
Nodes (1): Ensure currency is 3-letter code.

### Community 16 - "Coverage Favicon"
Cohesion: 1.0
Nodes (1): Coverage Report Favicon (32x32)

### Community 17 - "Coverage Keyboard Icon"
Cohesion: 1.0
Nodes (1): Keyboard Shortcuts Toggle Icon

## Knowledge Gaps
- **36 isolated node(s):** `Test yfinance directly.`, `Test AAPL as comparison.`, `Create and return an async session factory.`, `Get a database session. Factory is lazily initialized.`, `Initialize database tables.` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Linting Config`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Environment`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Schema Rationale`** (1 nodes): `Validate symbol format - alphanumeric with limited special chars.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Schema Rationale`** (1 nodes): `Ensure currency is 3-letter code.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Coverage Favicon`** (1 nodes): `Coverage Report Favicon (32x32)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Coverage Keyboard Icon`** (1 nodes): `Keyboard Shortcuts Toggle Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PaperTrade API main application.` connect `Backend Core Models` to `API Layer`, `WebSocket & Real-time`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `UserCash` connect `Backend Core Models` to `Execution & Order Management`, `Provider Abstraction`, `Test Infrastructure`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `AssetPrice` connect `Provider Abstraction` to `Execution & Order Management`, `Backend Core Models`, `Test Infrastructure`, `WebSocket & Real-time`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Are the 91 inferred relationships involving `OrderSide` (e.g. with `Tests for order management.` and `Create test user cash.`) actually correct?**
  _`OrderSide` has 91 INFERRED edges - model-reasoned connections that need verification._
- **Are the 78 inferred relationships involving `Order` (e.g. with `Tests for order management.` and `Create test user cash.`) actually correct?**
  _`Order` has 78 INFERRED edges - model-reasoned connections that need verification._
- **Are the 76 inferred relationships involving `TradeFill` (e.g. with `Tests for order management.` and `Create test user cash.`) actually correct?**
  _`TradeFill` has 76 INFERRED edges - model-reasoned connections that need verification._
- **Are the 68 inferred relationships involving `OrderType` (e.g. with `Tests for order management.` and `Create test user cash.`) actually correct?**
  _`OrderType` has 68 INFERRED edges - model-reasoned connections that need verification._