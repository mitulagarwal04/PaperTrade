---
phase: 03-charts-technical-analysis
plan: 01
subsystem: charts
tags: [ohlc, yfinance, caching, candle-utils, indicators, lightweight-charts]
requires: []
provides: [chart-data-endpoint, candle-time-alignment, indicator-math, chart-deps]
affects: [backend/main.py, frontend/main.tsx]
tech-stack:
  added:
    - lightweight-charts@^5.2.0: frontend charting library
    - yfinance 1.2.2: backend OHLC data provider
  patterns:
    - FastAPI endpoint with run_in_executor for blocking yfinance calls
    - In-memory dict cache with per-resolution TTL
    - Barrel export pattern for indicator modules
    - TypeScript type module for chart domain types
key-files:
  created:
    - backend/app/api/routes/charts.py: OHLC endpoint with INTERVAL_MAP and caching
    - backend/tests/test_charts.py: 17 tests covering interval mapping, cache, validation
    - frontend/src/lib/types/chart.ts: ChartRange, ChartInterval, CandleData, IndicatorConfig types
    - frontend/src/lib/candleUtils.ts: alignTime, rangeToInterval, rangeToPeriod
    - frontend/src/lib/indicatorUtils.ts: barrel export for 5 indicator modules
    - frontend/src/lib/indicators/movingAverages.ts: SMA and EMA implementations
    - frontend/src/lib/indicators/oscillators.ts: RSI implementation (Wilder's smoothing)
    - frontend/src/lib/indicators/bollingerBands.ts: Bollinger Bands with configurable stdDev
    - frontend/src/lib/indicators/macd.ts: MACD line, signal line, histogram
    - frontend/src/lib/indicators/volumeAnalysis.ts: volume profile (total, average, per-candle)
    - frontend/src/pages/ChartPage.tsx: minimal placeholder for route registration
  modified:
    - frontend/src/lib/constants.ts: added CHART_CANDLE_COLORS, CHART_INDICATOR_COLORS, CHART_DRAWING_COLORS
    - backend/app/main.py: added charts_router import and registration
    - frontend/src/main.tsx: added ChartPage import and /chart/:symbol route
    - frontend/package.json: added lightweight-charts@^5.2.0 dependency
decisions:
  - Used in-memory dict cache instead of CacheManager (which is typed for AssetPrice) because chart OHLC data is bulkier and CacheManager's PriceCache model is designed for single-price entries. Per-resolution TTL (60s/300s/600s) matches the plan spec.
  - Indicator sub-modules were created inline with full implementations (not stubs) to satisfy TypeScript barrel export compilation and make them immediately usable by downstream plans.
  - ChartPage.tsx created as a minimal placeholder because the route registration in main.tsx requires the component to exist for TypeScript compilation.
metrics:
  duration: 249s
  completed_date: 2026-05-05
---

# Phase 3 Plan 1: Chart Data Pipeline and Utilities Summary

**One-liner:** OHLC endpoint via yfinance with in-memory caching, TypeScript chart types, candle time-alignment math, 5 indicator calculation modules (SMA, EMA, RSI, MACD, BB, Volume), and lightweight-charts v5.2.0 dependency installation.

## Tasks Executed

### Task 1: Backend OHLC endpoint with caching

Created `backend/app/api/routes/charts.py` with:
- `INTERVAL_MAP` constant mapping 7 timeframe ranges (1d through 5y) to yfinance period/interval pairs
- `GET /api/v1/charts/{symbol}` endpoint with `range` and optional `interval` query parameters validated via FastAPI regex pattern
- yfinance downloaded via `asyncio.get_event_loop().run_in_executor()` to keep the event loop non-blocking
- In-memory dict cache with per-resolution TTL (60s for intraday, 300s for 1h, 600s for daily+)
- Empty DataFrame returns 503; stale cache fallback on yfinance errors
- 17 tests in `backend/tests/test_charts.py` covering interval mapping, TTL values, successful data fetching, empty data, cache hits, stale fallback, and 422 validation for invalid params

**Commit:** `324f43c`

### Task 2: Frontend types, candle utilities, indicator calculations

Created TypeScript modules:
- `frontend/src/lib/types/chart.ts`: `ChartRange`, `ChartInterval`, `ChartType`, `CandleData`, `ChartResponse`, `IndicatorConfig` types
- `frontend/src/lib/candleUtils.ts`: `INTERVAL_MAP` record, `alignTime()` for 5m/15m/1h/1d/1wk boundaries, `rangeToInterval()`, `rangeToPeriod()`
- `frontend/src/lib/indicatorUtils.ts`: barrel export pattern referencing 5 sub-modules
- 5 indicator calculation modules with proper implementations:
  - `movingAverages.ts`: SMA (simple mean) and EMA (exponential, multiplier 2/(period+1))
  - `oscillators.ts`: RSI (Wilder's smoothing method)
  - `bollingerBands.ts`: Bollinger Bands with configurable stdDev
  - `macd.ts`: MACD line, signal line (EMA of MACD), histogram
  - `volumeAnalysis.ts`: volume profile (total, average, per-candle)

Modified `frontend/src/lib/constants.ts` with chart color constants from UI-SPEC.md:
- `CHART_CANDLE_COLORS`: up/down/wick colors matching the chart color extensions
- `CHART_INDICATOR_COLORS`: SMA (#3B82F6), EMA (#8B5CF6), RSI (#F59E0B), MACD (#6366F1), MACD signal (#F97316), MACD histogram (#A0A5B0), Bollinger (#14B8A6)
- `CHART_DRAWING_COLORS`: trendline, horizontal, vertical, ray (matching drawing colors table)

**Commit:** `407d8cd`

### Task 3: Install lightweight-charts, register routes

- Installed `lightweight-charts@^5.2.0` in frontend/package.json
- Added `charts_router` import and `app.include_router(charts_router, prefix="/api/v1")` in `backend/app/main.py`
- Added `ChartPage` import and `/chart/:symbol` route in `frontend/src/main.tsx`
- Created minimal `frontend/src/pages/ChartPage.tsx` placeholder for route completeness

**Commit:** `4a861b7`

## Deviations from Plan

### Rule 3 - Missing ChartPage component (prevented route registration)

**Issue:** `frontend/src/main.tsx` imports `ChartPage` from `./pages/ChartPage`, but the component doesn't exist yet (planned for 03-02). Without it, TypeScript compilation fails, blocking Task 3 completion.

**Fix:** Created `frontend/src/pages/ChartPage.tsx` as a minimal placeholder with a symbol display and "Chart loading..." message. The full chart component will be implemented in plan 03-02.

**Files modified:** `frontend/src/pages/ChartPage.tsx`

### In-memory cache vs CacheManager

**Issue:** The plan specifies importing `CacheManager` in the import pattern for charts.py, but CacheManager's interface is typed for `AssetPrice` objects (via `PriceCache` model with price/currency/source fields) and cannot store OHLC arrays.

**Fix:** Imported CacheManager as specified for pattern consistency, but used a module-level `_chart_cache` dict with timestamp-based expiry for actual chart data caching. This is more appropriate for bulk OHLC data and avoids schema changes to the existing cache infrastructure.

## Verification Results

- Backend test suite: **17/17 passed** (Python pytest)
- Frontend TypeScript compilation: **clean** (npx tsc --noEmit)
- lightweight-charts: **^5.2.0** confirmed in package.json
- Backend charts_router: **registered** with prefix="/api/v1"
- Frontend /chart/:symbol route: **registered** in main.tsx

## Known Stubs

| Location | File | Reason |
|----------|------|--------|
| `frontend/src/pages/ChartPage.tsx` | Line 8 | Placeholder component displays "Chart loading..." text. Full chart component with lightweight-charts integration will be built in plan 03-02. |

## Threat Surface

No new threat surface introduced beyond what was modeled in the plan's threat register. The chart endpoint's `range` and `interval` params are validated via FastAPI Query regex patterns (422 on mismatch). The `symbol` path param is passed to yfinance which handles invalid symbols gracefully (returns empty DataFrame -> 503). yfinance calls run in executor threads, not blocking the event loop.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `324f43c` | feat(03-01): backend OHLC chart data endpoint with caching |
| 2 | `407d8cd` | feat(03-01): frontend chart types, candle utils, indicator calculations |
| 3 | `4a861b7` | feat(03-01): install lightweight-charts, register API and frontend routes |

## Self-Check: PASSED

All created/modified files verified present on disk, all commits verified in git log, all tests passing.
