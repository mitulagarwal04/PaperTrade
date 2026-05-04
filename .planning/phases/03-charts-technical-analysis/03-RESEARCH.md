# Phase 3: Charts & Technical Analysis - Research

**Researched:** 2026-05-04
**Domain:** Financial charting, technical analysis, OHLC data pipelines
**Confidence:** MEDIUM

## Summary

Phase 3 delivers interactive price charts with technical indicators at `/chart/{symbol}`. The backbone is TradingView Lightweight Charts v5.2.0 (just published, replacing v4 assumptions from CONTEXT.md). The chart library provides fast canvas rendering for candlestick/line series but critically lacks built-in indicators and drawing tools -- both must be implemented as overlay series and custom canvas primitives respectively. Backend adds a new `/api/v1/charts/{symbol}` endpoint proxying yfinance historical OHLC data, while live WebSocket price ticks (5s interval) are aggregated into OHLC candles client-side for real-time chart updates.

**Primary recommendation:** Use `lightweight-charts@^5.2.0` wrapped in a ref-based React component. Compute all technical indicators client-side using a utility module (no server-side indicator calc per CONTEXT.md). Implement drawing tools as a custom canvas overlay using the v5 Primitive API since the library has none built-in.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chart rendering & interaction | Browser | -- | lightweight-charts runs in DOM canvas; server has no role |
| OHLC data fetching | API / Backend | -- | yfinance runs server-side; returns cleaned JSON |
| Candle aggregation from WS | Browser | -- | WS price ticks aggregated client-side for chart.update() |
| Technical indicator calc | Browser | -- | No server-side calc per CONTEXT.md decision |
| Drawing tools persistence | Browser | -- | localStorage per-symbol; no server DB needed |
| Timeframe selector UI | Browser | -- | Pure React state, triggers data refetch |
| Historical data caching | API / Backend | -- | CacheManager pattern, PostgreSQL-based |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lightweight-charts | ^5.2.0 | Chart rendering library | TradingView's official canvas chart, fast, small (~45KB). v5.2.0 published 1 week ago [VERIFIED: npm registry] |
| yfinance | ^1.2.2 | Historical OHLC data source | Already in project; ticker.history() returns pandas DataFrame with Open/High/Low/Close/Volume [VERIFIED: pip show] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fancy-canvas | 2.1.0 | lightweight-charts dependency | Auto-installed with lightweight-charts; handles canvas sizing/binding |
| pandas | ^2.x | DataFrame manipulation | yfinance returns pandas DataFrames; used server-side for JSON serialization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lightweight-charts | TradingView Advanced Charts | Advanced Charts is paid/freemium; lightweight-charts is free and sufficient for v1 |
| lightweight-charts | Recharts | Recharts lacks candlestick type; would need custom SVG path rendering, much heavier |
| lightweight-charts | D3.js + custom SVG | Full custom chart is vastly more work; canvas performance would need manual optimization |

**Installation:**
```bash
npm install lightweight-charts@^5.2.0
# No backend pip install needed -- yfinance already installed
```

**Version verification:** `lightweight-charts@5.2.0` confirmed via `npm view lightweight-charts version` [VERIFIED: npm registry].

## Architecture Patterns

### System Architecture Diagram

```
User Browser                              Backend (FastAPI)
+---------------------------+             +---------------------+
|   /chart/{symbol} Page   |             |                     |
|                           |  GET /api/v1/charts/{symbol}?    |
| React Router v6           |---------->| interval=1d&range=1mo|
|                           |  [JSON]    |                     |
|                           |<----------| yfinance.ticker      |
| +----------------------+  |  OHLC[]   |   .history()         |
| | ChartContainer (ref) |  |           | CacheManager         |
| |  lightweight-charts  |  |           | (stale-while-reval)  |
| |  v5.2.0 instance     |  |           +---------------------+
| |                      |  |
| | - CandlestickSeries  |  |           WebSocket (existing)
| | - MA (line overlay)  |  |           ws:///ws/prices
| | - RSI (line overlay) |  |           {prices: {SYM: {price}}}
| | - Volume (histogram) |  |           every 5s
| | - Bollinger Bands    |  |                  |
| |   (line overlays)    |  |                  v
| | - MACD (hist+lines)  |  |           +--------------------+
| |                      |  |           | CandleAggregator   |
| +----------------------+  |           | price tick -> OHLC |
|                           |           | Time-bucketed Map |
| +----------------------+  |           | chart.update()    |
| | DrawingTools (canvas)|  |           +--------------------+
| | Trendlines           |  |
| | Annotations          |  |           +--------------------+
| | localStorage persist |  |           | indicatorUtils.ts |
| +----------------------+  |           | MA, RSI, MACD,    |
|                           |           | Bollinger, Volume  |
| +----------------------+  |           +--------------------+
| | TimeframeSelector    |  |
| | 1D, 5D, 1M, 3M...   |  |
| +----------------------+  |
+---------------------------+
```

### Recommended Project Structure

**Backend additions:**
```
backend/app/api/routes/charts.py   # NEW: /api/v1/charts/{symbol} endpoint
```

**Frontend additions:**
```
frontend/src/
  pages/ChartPage.tsx                    # NEW: /chart/{symbol} page
  components/chart/                      # NEW: chart components dir
    ChartContainer.tsx                   # React wrapper for lightweight-charts
    ChartToolbar.tsx                     # Indicator toggles, timeframe selector
    indicators/                          # Client-side indicator calculations
      movingAverages.ts
      oscillators.ts
      bollingerBands.ts
      macd.ts
      volumeAnalysis.ts
    drawingTools/                        # Custom canvas drawing tools
      DrawingCanvas.tsx                  # Canvas overlay + Primitive API
      drawingState.ts                    # localStorage persistence
  hooks/
    useChartData.ts                      # Fetch historical + real-time candle merge
    useCandleAggregator.ts               # WS price -> OHLC aggregation
    useTimeframe.ts                      # Timeframe selector state
  lib/
    candleUtils.ts                       # Time-bucketing, OHLC aggregation
    indicatorUtils.ts                    # Export all indicator calcs
```

### Pattern 1: Ref-Based Chart Wrapper (React)

**What:** Wrap lightweight-charts imperative API in a React component using ref and useEffect. The chart instance lives in a ref, not state -- React manages lifecycle, but chart rendering is entirely imperative.

**When to use:** Always. lightweight-charts provides no declarative React bindings. This is the officially recommended integration pattern.

**Example:**
```typescript
// Source: ASSUMED -- standard pattern from lightweight-charts docs and community practice
import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

interface ChartContainerProps {
  data: CandlestickData[];
  onCrosshairMove?: (price: number) => void;
}

export function ChartContainer({ data }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      width: containerRef.current.clientWidth,
      height: 600,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    candleSeries.setData(data);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    // ResizeObserver for responsive chart
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data]);

  // Expose seriesRef for external updates (candle aggregation, indicator overlays)
  return <div ref={containerRef} className="w-full" />;
}
```

### Pattern 2: Indicator as Overlay Series

**What:** Each technical indicator is a separate series (LineSeries, HistogramSeries) overlaid on the same chart with a different price scale (or same for MA/Bollinger, separate for RSI/MACD).

**When to use:** For every indicator -- MA, Bollinger Bands share main price scale; RSI, MACD get dedicated panes (or a separate 'study' div below main chart).

**Example:**
```typescript
// MA as line series on main chart (same price axis)
const maSeries = chart.addLineSeries({
  color: '#f59e0b',
  lineWidth: 1,
  priceFormat: { type: 'price' },
  lastValueVisible: false,
  priceLineVisible: false,
});
maSeries.setData(maData); // [{ time: '2024-01-01', value: 150.5 }]

// RSI as separate pane (requires a separate div container for secondary chart)
// Lightweight-charts does not natively support sub-charts/panes.
// Recommendation: use a second chart instance below the main chart.
const rsiContainer = document.getElementById('rsi-pane');
const rsiChart = createChart(rsiContainer, {
  layout: { background: { type: ColorType.Solid, color: '#131722' } },
  height: 150,
});
const rsiLine = rsiChart.addLineSeries({ color: '#8b5cf6' });
rsiLine.setData(rsiData); // [{ time: '2024-01-01', value: 65 }]
```

### Anti-Patterns to Avoid

- **React state for chart data:** Never store chart data in React state and `setData` on every render. Use refs and imperative updates instead. React state triggers re-renders that fight with the canvas.
- **Server-side indicator calc per CONTEXT.md:** Do NOT calculate MA/RSI/MACD on the backend. The CONTEXT.md explicitly says "no server-side indicator calc". Compute everything in `indicatorUtils.ts`.
- **Polling instead of WS update:** The existing WebSocket broadcasts every 5s. Use `chart.update()` on each WS tick aggregated to a candle. Do NOT add a separate polling endpoint.
- **Re-creating chart on data change:** The chart should be created once. Use `series.setData()` to replace data, `series.update()` for real-time ticks. Only `remove()` on component unmount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas chart rendering | Custom canvas chart | lightweight-charts v5.2.0 | Production-ready, handles time axis, crosshair, zoom/pan, touch interaction, 45KB gzipped |
| OHLC data from Yahoo | Custom REST scraping | yfinance ticker.history() | Already installed, handles symbol normalization, rate limiting, retry logic |
| Candle time-bucketing | Custom time math | useCandleAggregator hook | Straightforward to implement (Date alignment to interval), but use a well-tested pattern from existing charting apps rather than writing from scratch |
| Technical indicator math | Custom MA/RSI/MACD | Custom util functions | Indicators are simple math (MA is rolling window avg, RSI is avg gain/loss ratio over window). No library needed -- 10-20 lines each. Pandas has .rolling() on backend but we compute client-side. |

## Common Pitfalls

### Pitfall 1: lightweight-charts v4 vs v5 API Breaking Changes
**What goes wrong:** CONTEXT.md was written assuming v4 API. v5.2.0 is the current release and has different APIs for creating series and handling options. Code written for v4 will not compile or may exhibit bugs.
**Why it happens:** v5 was a major internal rewrite. The npm registry confirms v5.2.0 was published ~1 week ago (late April 2026).
**How to avoid:** Use v5 API from day one. Key differences: ColorType enum for layout background, changes to marker API, Time type strictness, and Primitive API for drawing tools.
**Warning signs:** If you see IChartApi methods missing or type errors with ColorType, you are using v4 types.

### Pitfall 2: No Built-in Indicators or Drawing Tools
**What goes wrong:** The chart library renders candles and lines but does NOT compute RSI/MACD/MA or provide trendline/annotation tools. These must be built.
**Why it happens:** lightweight-charts is a "lightweight" rendering engine, not a full trading platform. It provides primitives (candlestick, line, histogram series) but no indicator library.
**How to avoid:** Plan separate tasks for: (1) indicator calculation utilities, (2) overlay series for each indicator, (3) custom drawing canvas using v5 Primitive API.
**Warning signs:** Searching for "indicator" in lightweight-charts docs returns nothing substantial.

### Pitfall 3: yfinance Intraday Data Restrictions
**What goes wrong:** Requesting 1m interval data for a 1Y range returns empty DataFrame. yfinance enforces: 1m max 7 days, 5m/15m/30m max 60 days, 1h max 730 days.
**Why it happens:** Yahoo Finance API restricts intraday data availability. The library respects these limits.
**How to avoid:** Map timeframes to valid interval/period combinations:
- 1D -> interval=5m, period=1d
- 5D -> interval=15m, period=5d
- 1M -> interval=1h, period=1mo (or 30m, period=1mo)
- 3M -> interval=1d, period=3mo
- 6M -> interval=1d, period=6mo
- 1Y -> interval=1d, period=1y
- 5Y -> interval=1wk, period=5y
**Warning signs:** Empty DataFrame from ticker.history() -- most likely interval/period mismatch.

### Pitfall 4: Chart/Page Not Found Route Missing
**What goes wrong:** Navigating to `/chart/AAPL` shows 404. React Router has no route for this page.
**Why it happens:** The existing App.tsx (read from file) uses `<Outlet />` with a sidebar layout but does not include a `/chart/:symbol` route.
**How to avoid:** Add the route in App.tsx or the router config during this phase.
**Warning signs:** Route is not defined = 404. This is a simple addition but easy to forget.

### Pitfall 5: YFinance History Blocks the Event Loop
**What goes wrong:** `ticker.history()` is synchronous (runs in the yfinance library thread). Calling it in an async endpoint blocks the FastAPI event loop.
**Why it happens:** yfinance uses `requests` under the hood, not `httpx` or `aiohttp`. The existing `YFinanceProvider.fetch_price()` already handles this with `run_in_executor`.
**How to avoid:** Use the same pattern: `await asyncio.get_event_loop().run_in_executor(None, lambda: ticker.history(period, interval))`. Or reuse the existing YFinanceProvider pattern.
**Warning signs:** Price broadcast pauses during history fetches.

### Pitfall 6: Candle Timestamp Alignment for chart.update()
**What goes wrong:** WS price ticks arrive every 5s. Aggregating into 1D candles requires aligning to day boundaries. A misaligned timestamp creates a new candle when it should update the current one.
**Why it happens:** `chart.update()` uses the `time` field to match existing candles. If the aggregated timestamp does not exactly match the candle's time (e.g., using `Date.now()` vs rounding to interval), a second overlapping candle appears.
**How to avoid:** Write a `candleUtils.ts` `alignTime(ts, interval)` function that rounds down to the nearest interval boundary. Use the same alignment function for both historical data and real-time ticks.
**Warning signs:** Double candles at the right edge, or chart showing overlapping candles.

## Code Examples

### Frontend Candle Aggregation from WS

```typescript
// Source: ASSUMED -- standard OHLC aggregation pattern
type Interval = '1m' | '5m' | '15m' | '1h' | '1d';

interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function alignTime(ts: number, interval: Interval): number {
  const date = new Date(ts * 1000);
  switch (interval) {
    case '1m':
      date.setSeconds(0);
      break;
    case '5m':
      date.setMinutes(Math.floor(date.getMinutes() / 5) * 5);
      date.setSeconds(0);
      break;
    case '15m':
      date.setMinutes(Math.floor(date.getMinutes() / 15) * 15);
      date.setSeconds(0);
      break;
    case '1h':
      date.setMinutes(0);
      date.setSeconds(0);
      break;
    case '1d':
      date.setHours(0, 0, 0, 0);
      break;
  }
  return Math.floor(date.getTime() / 1000);
}

export function useCandleAggregator(symbol: string, interval: Interval) {
  const candleMapRef = useRef<Map<number, Candle>>(new Map());

  // Subscribe to WS price ticks
  const currentPrice = usePriceStore((s) => s.prices[symbol]?.price);

  useEffect(() => {
    if (currentPrice == null) return;

    const now = Math.floor(Date.now() / 1000);
    const aligned = alignTime(now, interval);
    const existing = candleMapRef.current.get(aligned);

    if (!existing) {
      candleMapRef.current.set(aligned, {
        time: aligned,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
      });
    } else {
      existing.high = Math.max(existing.high, currentPrice);
      existing.low = Math.min(existing.low, currentPrice);
      existing.close = currentPrice;
    }

    // Call seriesRef.update() with latest candle
    // (needs a ref to the chart series from ChartContainer)
  }, [currentPrice]);
}
```

### Backend yfinance History Endpoint

```python
# Source: ASSUMED -- based on existing YFinanceProvider pattern
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.cache.manager import CacheManager
from app.api.deps import get_db
import asyncio

router = APIRouter()

# Interval/period compatibility map
INTERVAL_MAP = {
    "1d":  {"period": "1d",  "interval": "5m"},
    "5d":  {"period": "5d",  "interval": "15m"},
    "1mo": {"period": "1mo", "interval": "1h"},
    "3mo": {"period": "3mo", "interval": "1d"},
    "6mo": {"period": "6mo", "interval": "1d"},
    "1y":  {"period": "1y",  "interval": "1d"},
    "5y":  {"period": "5y",  "interval": "1wk"},
}

@router.get("/charts/{symbol}")
async def get_chart_data(
    symbol: str,
    range: str = Query("1mo", alias="range"),
    interval: str = Query(None, alias="interval"),
    session=Depends(get_db),
):
    """Fetch historical OHLC data for charting."""
    # If interval not provided, derive from range
    if interval is None:
        config = INTERVAL_MAP.get(range)
        if not config:
            raise HTTPException(400, f"Invalid range: {range}")
        interval = config["interval"]
        period = config["period"]
    else:
        period = range

    cache = CacheManager(session)
    cache_key = f"chart:{symbol}:{period}:{interval}"

    # Check cache first (charts cached longer: 60s for intraday, 300s for daily)
    cached = await cache.get(cache_key, ttl_seconds=300)
    if cached and not cached.is_stale:
        return cached

    # Fetch via yfinance in executor
    import yfinance as yf
    import json
    import pandas as pd

    loop = asyncio.get_event_loop()
    df = await loop.run_in_executor(
        None,
        lambda: yf.download(symbol, period=period, interval=interval, progress=False, auto_adjust=True),
    )

    if df.empty:
        raise HTTPException(503, f"No historical data for {symbol}")

    # Format for lightweight-charts
    result = []
    for index, row in df.iterrows():
        # yfinance returns DatetimeIndex
        ts = int(index.timestamp())
        result.append({
            "time": ts,
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]) if "Volume" in row else 0,
        })

    return {"symbol": symbol, "interval": interval, "data": result}
```

### Drawing Tools State Persistence

```typescript
// Source: ASSUMED -- localStorage pattern for primitive drawing state
export interface Trendline {
  id: string;
  type: 'trendline';
  point1: { time: Time; price: number };
  point2: { time: Time; price: number };
  color: string;
  lineWidth: number;
}

export interface Annotation {
  id: string;
  type: 'annotation';
  time: Time;
  price: number;
  text: string;
  color: string;
}

type Drawing = Trendline | Annotation;

const STORAGE_KEY_PREFIX = 'chart-drawings:';

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${symbol}`,
    JSON.stringify(drawings),
  );
}

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${symbol}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lightweight-charts v4 (assumed in CONTEXT.md) | lightweight-charts v5.2.0 | Late April 2026 | Different API for series creation, ColorType enum, Primitive API for custom drawing |
| No chart data | New /api/v1/charts/{symbol} endpoint | This phase | Backend needs new route file |
| Recharts as stack default (CLAUDE.md) | lightweight-charts (CONTEXT.md override) | Discuss phase decision | CONTEXT.md locked this choice |

**Deprecated/outdated:**
- CONTEXT.md references "TradingView Lightweight Charts library (~45KB, built-in indicators)". The "built-in indicators" part is incorrect -- v4 did not have built-in indicators, nor does v5. All indicators must be client-calculated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | lightweight-charts v5.2.0 API matches my training knowledge (ColorType, createChart, addCandlestickSeries, Primitive API) | Standard Stack | Could cause compile errors; need to verify full API surface when writing code |
| A2 | No drawing tools built into v5; must use custom canvas/Primitive API | Don't Hand-Roll | If v5.2.0 added drawing tools, custom implementation is wasted effort |
| A3 | yfinance ticker.history() interval/period compatibility mapping is correct (1m=7d, 5m=60d, etc.) | Common Pitfalls 3 | Yahoo may change limits; test each combination during implementation |
| A4 | React wrapper pattern using ref + useEffect + ResizeObserver is correct | Architecture Patterns | If v5 has a new official React binding, our wrapper is redundant |
| A5 | Chart page route /chart/{symbol} does not exist yet | Common Pitfalls 4 | Need to verify App.tsx routes (was only partially read from cache) |

## Open Questions

1. **How to implement sub-charts/panes for RSI and MACD?**
   - What we know: lightweight-charts does not support multi-pane charts natively. Each study needs a separate chart instance.
   - What's unclear: Should RSI and MACD be in separate `<div>` elements below the main chart (two chart instances), or in a single overlay with a secondary price axis?
   - Recommendation: Two chart instances in a stacked layout. Main candle chart (60% height) + RSI/MACD study chart (40% height). Sync time scales manually via `chart.timeScale().subscribeVisibleTimeRangeChange()`.

2. **Drawing tools implementation strategy?**
   - What we know: lightweight-charts has no built-in drawing tools. The v5 Primitive API allows custom canvas rendering.
   - What's unclear: Is the Primitive API stable and documented enough for trendlines/annotations? Or should we use a separate canvas overlay on top of the chart?
   - Recommendation: Start with the Primitive API example from TradingView docs. If too complex, fall back to an HTML overlay with absolute positioning (annotations as absolutely positioned divs, trendlines as SVG overlay). The Primitive API approach is preferred for performance but needs verification.

3. **Should OHLC candle data be cached differently from price data?**
   - What we know: `cache_ttl_seconds` defaults to 300s (5 min). Historical data is static (doesn't change for past dates).
   - What's unclear: Should we use a longer TTL for chart data? The last candle is the only one that changes.
   - Recommendation: Cache historical data with a longer TTL (1h for intraday, 24h for daily/weekly) since only the most recent candle is mutable. Use the CacheManager pattern with symbol+interval+period as cache key.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | pyproject.toml (asyncio_mode = "auto") |
| Quick run command | `cd backend && python -m pytest tests/test_charts.py -x -v` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TA-01 | /api/v1/charts/{symbol} returns OHLC JSON for valid symbol+range | integration | `pytest tests/integration/test_charts.py::test_get_chart_data -x` | New |
| TA-01 | /api/v1/charts/{symbol} returns 503 for invalid symbol | integration | `pytest tests/integration/test_charts.py::test_chart_data_invalid_symbol -x` | New |
| TA-01 | Interval/period mapping correct for all 7 ranges | unit | `pytest tests/test_charts.py::test_interval_mapping -x` | New |
| TA-02 | Candlestick series renders OHLC data correctly | manual | Puppeteer/Playwright screenshot test deferred | N/A v1 |
| TA-03 | Drawing tools serialize/deserialize from localStorage | manual | N/A -- UI-only behavior | N/A |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_charts.py -x` (if file exists) or `cd backend && python -m pytest tests/ -x` for existing tests only
- **Phase gate:** Full backend test suite green; manual frontend smoke test of chart page

### Wave 0 Gaps
- [ ] `backend/tests/test_charts.py` -- covers TA-01 interval mapping and response format
- [ ] `backend/tests/integration/test_charts.py` -- covers TA-01 endpoint integration
- [ ] No frontend test infrastructure exists (no jest/vitest config, no __tests__ dir). Mark frontend validation as manual for v1.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | FastAPI Query parameter validation (range enum, symbol regex) |
| V20 API Security | yes | Endpoint added to existing authenticated API (no-auth v1, but same cors/hosts protections) |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| yfinance abuse (excessive requests) | DoS | CacheManager with TTL; rate limit via yfinanceProvider existing rate_limit_delay |
| Symbol injection in history endpoint | Tampering | FastAPI typed params; yfinance handles invalid symbols gracefully |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| lightweight-charts npm | Chart rendering | No (not installed) | 5.2.0 | Install via `npm install lightweight-charts@^5.2.0` |
| yfinance | Backend OHLC data | Yes | 1.2.2 | -- |
| Python 3.11+ | Backend runtime | Yes (3.13) | 3.13 | -- |
| Node 18+ | Frontend build | TBD | TBD | -- |

**Missing dependencies with no fallback:**
- `lightweight-charts@^5.2.0` must be npm installed. This is a straightforward dependency add.

**Missing dependencies with fallback:**
- None. All other deps (yfinance, React, TypeScript, FastAPI) are already installed.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] -- lightweight-charts@5.2.0, published ~1 week ago, dist-tag latest
- [VERIFIED: pip show] -- yfinance@1.2.2, already installed
- [VERIFIED: file read] -- Existing backend patterns (CacheManager, YFinanceProvider, BaseProvider)
- [VERIFIED: file read] -- Existing frontend patterns (useWebSocket, priceStore, ErrorBanner, LoadingSkeleton, useAssets hook)
- [VERIFIED: file read] -- Project config: nyquist_validation enabled, mode yolo, cache_ttl_seconds=300

### Secondary (MEDIUM confidence)
- [ASSUMED] -- lightweight-charts v5 API details (ColorType, createChart, Primitive API, no built-in indicators)
- [ASSUMED] -- yfinance history period/interval compatibility matrix
- [ASSUMED] -- React wrapper pattern (ref + useEffect + ResizeObserver)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified via npm registry
- Architecture: MEDIUM -- patterns are standard but some v5 API details are ASSUMED
- Pitfalls: HIGH -- verified via code reading and known yfinance/library limitations
- Drawing tools: LOW -- no way to verify Primitive API status without fetching docs

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 days for stable libraries)
