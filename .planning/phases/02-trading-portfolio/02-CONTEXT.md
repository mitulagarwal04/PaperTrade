# Phase 2: Trading & Portfolio - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Order placement, management, and portfolio tracking. Users can place market/limit/stop/take-profit orders, view open orders, cancel orders, and see portfolio P&L with full trade history. Single-user, no auth required. Real-time updates via WebSocket.
</domain>

<decisions>
## Implementation Decisions

### Order Types (TRADE-01)
- **D-01:** Support Market + Limit + Stop Loss + Take Profit orders
- **D-02:** Stop/Take-Profit orders trigger monitoring service watching price feeds

### Order Execution (TRADE-03, TRADE-04)
- **D-03:** Simulated execution with 50-500ms delay + random slippage (0.01-0.1%)
- **D-04:** Support partial fills — orders track filled_quantity vs requested_quantity
- **D-05:** Fill records per execution event, aggregated per order

### Portfolio Data Model (PORT-01)
- **D-06:** FIFO lot tracking — each purchase creates separate lot, sells consume oldest first
- **D-07:** Realized P&L calculated per lot sale using FIFO cost basis
- **D-08:** Store original transaction currency (USD/EUR), convert to INR for display via live FX rates
- **D-09:** Unrealized P&L recalculated on each price update

### Cash Management
- **D-10:** Reserve cash on order placement, release on cancel
- **D-11:** Available balance = cash - reserved - holdings_value
- **D-12:** Fixed 100,000 INR starting capital (no config variation for v1)

### Trade History (PORT-02)
- **D-13:** Full audit trail: order ID, all fills with timestamps, status transitions
- **D-14:** Include execution latency per fill, slippage realized

### P&L & Performance (PORT-03)
- **D-15:** Total P&L (realized + unrealized)
- **D-16:** Win rate (% of profitable trades)
- **D-17:** Average gain/loss per trade
- **D-18:** Maximum drawdown from peak portfolio value

### Portfolio Reset (PORT-04)
- **D-19:** Archive current portfolio state (positions, cash, metrics) to history table
- **D-20:** Create fresh portfolio with 100K INR starting capital
- **D-21:** Archive enables performance analysis over multiple trading periods

### Order Management (TRADE-02)
- **D-22:** Limit orders are GTC (Good Till Canceled) — no auto-expiry
- **D-23:** No in-place modification — cancel and replace workflow only
- **D-24:** Stop/Take-Profit orders monitored by background service checking price triggers

### Claude's Discretion
- Partial fill threshold behavior (treat small remainder as complete vs leave open)
- Stop-order trigger price tolerance (exact touch vs crossover)
- Archive retention policy (keep all vs prune old)
- Portfolio reset confirmation flow UI

### Deferred Ideas
- **Multi-portfolio support:** For A/B testing algorithm training strategies (user requested future feature)
- Day-only time-in-force option
- In-place order modification
- Configurable starting capital

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TRADE-01 through TRADE-05, PORT-01 through PORT-04
- `.planning/CLAUDE.md` — Technology stack, constraints (100K INR, single-user)

### Prior Phase
- `.planning/phases/01-data-infrastructure/01-CONTEXT.md` — Data infrastructure decisions (if exists)
- `.planning/phases/01-data-infrastructure/01-PLAN.md` — ProviderRegistry, WebSocket, cache patterns

### Existing Code
- `backend/app/database.py` — SQLAlchemy async setup, Base metadata
- `backend/app/config.py` — Settings with Pydantic
- `backend/app/cache/manager.py` — PostgreSQL cache with stale-while-revalidate
- `backend/app/websocket/manager.py` — ConnectionManager for real-time pushes
- `backend/app/providers/` — Provider abstraction for price feeds

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Database layer:** `get_session()` async context manager already set up in `database.py`
- **WebSocket:** `ConnectionManager.broadcast()` ready for portfolio updates
- **Cache:** `CacheManager` can store portfolio snapshots for quick reload
- **ProviderRegistry:** YFinance/CoinGecko providers for price feed polling

### Established Patterns
- **Async SQLAlchemy:** All DB operations use async session pattern
- **Pydantic validation:** Settings and API schemas use Pydantic
- **FastAPI routes:** REST endpoints in `api/routes/` pattern
- **Environment config:** `.env` file with required/optional vars

### Integration Points
- Orders table will reference `assets` table from Phase 1 for symbol validation
- Portfolio updates will push via WebSocket using existing `ConnectionManager`
- Price feed from Phase 1 providers drives unrealized P&L updates
- Cache layer stores computed portfolio summary for fast reads

### Dependencies Already Present
- `sqlalchemy[asyncio]` for ORM
- `asyncpg` or `aiosqlite` via existing database setup
- FastAPI for API routes
- Pydantic for validation

</code_context>

<specifics>
## Specific Ideas

- User mentioned training algorithms — future multi-portfolio support for A/B testing
- Archive feature requested specifically to preserve trading history during resets
- Full audit trail important for algo performance debugging
- FIFO chosen for tax-realism (standard tax accounting method)

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

### Post-v1 Features
- Multiple portfolios for algorithm training/A-B testing
- Configurable starting capital per portfolio
- Day-only order validity
- In-place order modification

</deferred>

---

*Phase: 02-trading-portfolio*
*Context gathered: 2026-04-20*
