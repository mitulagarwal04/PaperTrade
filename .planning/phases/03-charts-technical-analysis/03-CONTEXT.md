# Phase 3: Charts & Technical Analysis — Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Interactive candlestick + line charts for any asset, with technical indicators (MA, RSI, MACD, Bollinger, Volume), drawing tools with session persistence, multiple timeframe presets, and live real-time updates via WebSocket.

Covers requirements TA-01, TA-02, TA-03. External signals and AI advisor are Phases 4 and 5.

</domain>

<decisions>
## Implementation Decisions

### Chart Library & Types
- **D-01:** TradingView Lightweight Charts — purpose-built financial charting lib, ~45KB gzipped, built-in MA/RSI/MACD calculations, industry standard. Needs thin React wrapper (imperative API).
- **D-02:** Candlestick + Line chart types for v1. Add Bar, Area, Heikin-Ashi in later versions. TradingView LW supports all natively — just series type swap.

### Chart Page UX
- **D-03:** Full dedicated chart page at `/chart/{symbol}`. Click asset symbol (from AssetsPage, PortfolioPage, Dashboard) → navigates to chart. Standard brokerage pattern. Not side panel or modal.
- **D-04:** Same page, responsive — chart adapts to screen width on mobile. TradingView LW handles touch natively. Controls reposition below chart on small screens.

### Technical Indicators
- **D-05:** Full suite for v1 — MA (SMA/EMA), RSI, MACD, Bollinger Bands, Volume. All built into TradingView LW out of box. Requires indicator selector UI with config panels (period, colors).

### Drawing Tools
- **D-06:** Full drawing suite — trendlines, horizontal/vertical lines, ray lines, text annotations, with session persistence. Meets TA-03 and SC-3 fully in v1. Significant dev effort for drawing state management and canvas interactions.

### Timeframes
- **D-07:** Standard preset range — 1D (5m candles), 5D (15m), 1M (1h), 3M (1h), 6M (1d), 1Y (1d), 5Y (1d). 7-button selector. No custom date range picker in v1.

### Real-time & Backend
- **D-08:** Live WebSocket updates — chart subscribes to existing `/ws/prices` stream and updates current candle in real-time via TradingView LW's `chart.update()`. Needs frontend candle aggregation from price tick stream.
- **D-09:** Backend proxy — new `/api/v1/charts/{symbol}?interval={interval}&range={range}` endpoint. Backend fetches OHLCV from yfinance, caches candle data, returns standard format. Consistent with existing architecture. No server-side indicator calc in v1 (TradingView LW handles clientside).

### States & Error Handling
- **D-10:** Full chart-area skeleton during load, inline ErrorBanner inside chart container on failure (reuses existing ErrorBanner component), empty state: "No chart data available". Consistent with existing app patterns.

### Carried Forward (from Phase 2.5)
- Dark mode only v1 (D-06 from 02.5-CONTEXT)
- TanStack Query + Zustand state management
- React Router v6 routing
- Manual typed fetch wrappers (api.get/api.post)
- WS auto-reconnect with exponential backoff
- ErrorBanner, LoadingSkeleton patterns

### Claude's Discretion
- Thin React wrapper component design for TradingView LW
- Chart color palette (within dark theme)
- Indicator config panel UX (period inputs, color pickers)
- Drawing toolbar layout and icon set
- Candle aggregation logic from WS price ticks
- Exact API shape for `/api/v1/charts` endpoint
- Loading skeleton design for chart area
- Mobile breakpoint and control repositioning details

</decisions>

<canonical_refs>
## Canonical References

### Backend API
- `backend/app/main.py` — FastAPI app, WebSocket endpoint, route registration pattern
- `backend/app/api/routes/prices.py` — Existing prices endpoint (model for charts endpoint)
- `backend/app/cache/manager.py` — Cache manager for candle data caching

### Frontend
- `frontend/src/lib/api.ts` — API client pattern (api.get, api.post)
- `frontend/src/lib/constants.ts` — WS_URL, REFETCH_INTERVAL, staleness constants
- `frontend/src/hooks/useWebSocket.ts` — WebSocket hook (reuse for chart WS updates)
- `frontend/src/hooks/useAssets.ts` — useQuery pattern (model for chart data hook)
- `frontend/src/pages/AssetsPage.tsx` — Asset list (entry point for chart navigation)
- `frontend/src/components/shared/ErrorBanner.tsx` — Reusable error banner component
- `frontend/src/components/shared/LoadingSkeleton.tsx` — Skeleton pattern

### Design & Requirements
- `CLAUDE.md` — Tech stack, responsive breakpoints, WCAG AA, accessibility rules
- `.planning/ROADMAP.md` — Phase 3 goal: SC-1 (candlestick/line + zoom/pan + real-time), SC-2 (indicators live), SC-3 (drawing tools persistence), SC-4 (chart type switch + timeframe customization)
- `.planning/REQUIREMENTS.md` — TA-01 (interactive charts with indicators), TA-02 (multiple chart types), TA-03 (drawing tools)
- `.planning/phases/02.5-frontend/02.5-CONTEXT.md` — Prior frontend decisions (dark mode, routing, state management)
- `~/.claude/skills/ui-ux-pro-max/` — Design system generation (mandatory before UI code per CLAUDE.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ErrorBanner** — Inline error with retry button. Reuse for chart error states.
- **LoadingSkeleton** — TableSkeleton variant. Adapt for chart loading state.
- **useWebSocket hook** — WS connection management with auto-reconnect. Reuse for chart WS subscriptions.
- **useQuery patterns** — useAssets, usePortfolio, useOrders. Model for chart data hook.
- **Sheet component** — Side panel. Not needed (full page chosen) but exists if used for indicator config.
- **Dark theme CSS variables** — Background, surface, border, text colors already defined.
- **Constants** — STALE_THRESHOLD_MS, WS_URL, REFETCH_INTERVAL can be extended with chart-specific consts.

### Integration Points
- **Routes** — Add `/chart/:symbol` route in App.tsx. Pattern: existing page routes.
- **Navigation** — AssetPriceRow click handler navigates to chart. Sidebar doesn't need new top-level link (charts accessed via asset click).
- **Backend** — New `/api/v1/charts` route in `backend/app/api/routes/` following prices.py pattern. Register in main.py.
- **WS Data** — Existing price stream at `/ws/prices` broadcasts `{type:"prices", data:{SYMBOL:{price,currency,source}}}`. Chart needs to subscribe for specific symbol ticks.

### Established Patterns
- REST API at `/api/v1/*` with JSON responses
- TanStack Query for server state (staleTime, refetchInterval)
- Zustand for real-time/WS state (priceStore)
- ErrorBanner with onRetry callback for all error states
- LoadingSkeleton for pending states across all pages

</code_context>

<specifics>
## Specific Ideas

- "Industry standard" approach for all decisions (user consistently chose the most common/popular option)
- Chart colors should match existing dark theme — not default TradingView LW colors
- Indicator config panels should be minimal: period input + color picker, no complex multi-tab panels

</specifics>

<deferred>
## Deferred Ideas

- Additional chart types (Bar, Area, Heikin-Ashi) — future versions
- Custom date range picker — future version
- Server-side indicator calculation — Phase 5 (AI Advisor) may need this, revisit then
- DB persistence for drawing annotations — session-only for v1, add persistence later if needed

</deferred>

---

*Phase: 03-charts-technical-analysis*
*Context gathered: 2026-05-04*
