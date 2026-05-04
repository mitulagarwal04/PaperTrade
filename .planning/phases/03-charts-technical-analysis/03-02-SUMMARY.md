---
phase: 03-charts-technical-analysis
plan: 02
subsystem: charts
tags: [lightweight-charts, chart-container, ohlc-data, timeframe-selector, price-info-bar]
requires: [03-01]
provides: [chart-components, chart-data-hooks, timeframe-management]
affects: [frontend/src/components/chart/, frontend/src/hooks/]
tech-stack:
  added: []
  patterns:
    - Ref-based wrapper pattern for imperative charting library (lightweight-charts)
    - TanStack Query hook for OHLC data fetching (per symbol+timeframe caching)
    - State hook with validation guard for typed union state
    - UI-SPEC.md color tokens mapped to lightweight-charts API options
key-files:
  created:
    - frontend/src/components/chart/ChartContainer.tsx: lightweight-charts React wrapper with candlestick/line support
    - frontend/src/hooks/useChartData.ts: TanStack Query hook for chart data endpoint
    - frontend/src/hooks/useTimeframe.ts: timeframe state management with 7 presets
    - frontend/src/components/chart/TimeframeSelector.tsx: 7-button preset row component
    - frontend/src/components/chart/PriceInfoBar.tsx: OHLC price display bar component
  modified: []
decisions:
  - ChartContainer uses three separate useEffect hooks (mount, data update, chart type swap) instead of a single effect with [data, chartType] deps, to avoid recreating the chart instance on data changes
  - onInit callback stored in a ref to always call the latest callback without requiring effect re-runs
  - Converted data type guard in chartType swap effect uses seriesType() introspection to avoid redundant swaps
metrics:
  duration: ~120s
  completed_date: 2026-05-05
---

# Phase 3 Plan 2: Chart Component Infrastructure Summary

**One-liner:** React wrapper around lightweight-charts v5.2.0 with candlestick/line support, TanStack Query hook for OHLC data fetching, timeframe state management with 7 presets, and compact TimeframeSelector/PriceInfoBar UI components.

## Tasks Executed

### Task 1: ChartContainer React wrapper

Created `frontend/src/components/chart/ChartContainer.tsx` with:
- Ref-based wrapper pattern per RESEARCH.md Pattern 1: `useRef<HTMLDivElement>` for container, `useRef<IChartApi>` for chart instance, `useRef<ISeriesApi>` for series
- Chart created once on mount via `useEffect([], [])` -- never recreated on data updates
- Data updates handled by a separate `useEffect([data, chartType])` calling `series.setData()`
- Chart type swap handled by a third effect: removes old series via `chart.removeSeries()`, adds new series type, calls `onInit` with the new series
- Dark theme colors from UI-SPEC.md: surface-1 (#13161C) background, secondary (#A0A5B0) text, grid colors rgba(42, 47, 59, 0.5), crosshair rgba(237, 238, 240, 0.3)
- Candlestick colors from `CHART_CANDLE_COLORS` constants: up #22C55E, down #EF4444
- Line series uses #3B82F6 (info/blue)
- onInit callback returns ChartContainerAPI `{ chart, series, container }` via a ref to always capture the latest callback
- ResizeObserver for responsive chart width on mount

**Commit:** `d0f0752`

### Task 2: Chart data hook and timeframe hook

Created `frontend/src/hooks/useChartData.ts`:
- `useChartData(symbol, range)` returns `useQuery<ChartResponse>`
- Query key: `['chart', symbol, range, interval]` -- per symbol+timeframe cache isolation
- Calls `api.get<ChartResponse>('/api/v1/charts/${symbol}?range=${range}&interval=${interval}')`
- `staleTime: 60_000` (1 minute) for historical data
- `retry: 2`, `enabled: !!symbol`
- `select` transforms response ensuring `time` is always a number

Created `frontend/src/hooks/useTimeframe.ts`:
- `useTimeframe(initialRange = '1mo')` returns `{ range, setRange, timeframeDefs }`
- `timeframeDefs` has exactly 7 entries: 1D/5D/1M/3M/6M/1Y/5Y
- `setRangeSafe` validates input against valid `ChartRange` values (no-op for invalid)

**Commit:** `7d66ec5`

### Task 3: TimeframeSelector and PriceInfoBar components

Created `frontend/src/components/chart/TimeframeSelector.tsx`:
- Props: `defs`, `active`, `onChange`
- Renders `defs` array as buttons with 28px height (h-7) per UI-SPEC
- Active button: `bg-surface-3 font-semibold text-primary`
- Inactive button: `text-secondary hover:text-primary hover:bg-surface-2`
- Focus-visible ring for keyboard accessibility

Created `frontend/src/components/chart/PriceInfoBar.tsx`:
- Props: `open`, `high`, `low`, `close`, `volume?`, `className?`
- Displays O/H/L/C with `text-xs tabular-nums text-secondary` per UI-SPEC
- Prices formatted with `en-IN` locale, 2 decimal places
- Volume formatted as compact (K/M suffix)
- Shows "No data" when values are null

**Commit:** `e407489`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript compilation (npx tsc --noEmit): **clean** (no errors)
- All 3 commits verified in git log
- No unintended file deletions detected
- All 5 files created on disk and committed

## Threat Surface

No new threat surface introduced. The ChartContainer renders canvas via lightweight-charts (no network access). useChartData constructs API URLs from typed `ChartRange` values -- symbol is a path param, range/interval are query params. No user-injectable values.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `d0f0752` | feat(03-02): ChartContainer React wrapper for lightweight-charts |
| 2 | `7d66ec5` | feat(03-02): useChartData and useTimeframe hooks |
| 3 | `e407489` | feat(03-02): TimeframeSelector and PriceInfoBar components |

## Self-Check: PASSED

All 5 files verified present on disk, all 3 commits verified in git log, TypeScript compilation passes with no errors.
