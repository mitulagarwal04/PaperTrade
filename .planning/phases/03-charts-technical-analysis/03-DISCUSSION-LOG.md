# Phase 3: Charts & Technical Analysis — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 03-charts-technical-analysis
**Areas discussed:** Chart Library & Types, Chart Page UX, Technical Indicators, Drawing Tools, Timeframes & Data, Real-time Updates & Backend, States & Error Handling

---

## Chart Library & Types

### Q-01: Which charting library?

| Option | Description | Selected |
|--------|-------------|----------|
| TradingView Lightweight Charts | Purpose-built financial charting. Candlestick, line, bar, area out of box. Built-in MA, RSI, MACD. ~45KB. Industry standard. | ✓ |
| Chart.js + react-chartjs-2 | General-purpose with candlestick plugin. ~60KB+ plugins. Less polished financial UX. | |
| Recharts | Pure React. NO built-in candlestick. Would need custom SVG. | |

**User's choice:** TradingView Lightweight Charts
**Notes:** Industry standard for trading UIs.

### Q-02: Which chart types for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Candlestick only | Standard OHLC. Simplest. | |
| Candlestick + Line | Both native in TradingView LW. Good balance. | ✓ |
| Full: Candle + Line + Bar + Area | Full flexibility. More UI complexity. | |

**User's choice:** Candlestick + Line, add more later
**Notes:** Add Bar, Area, Heikin-Ashi in future versions.

---

## Chart Page UX

### Q-03: How do users open a chart?

| Option | Description | Selected |
|--------|-------------|----------|
| Full dedicated chart page | Click asset → /chart/{symbol}. Full screen. Standard brokerage pattern. | ✓ |
| Slide-out side panel | Chart in right panel. Same pattern as order form. | |
| Modal / overlay | Centered overlay. Unusual for trading apps. | |

**User's choice:** Full dedicated chart page
**Notes:** Industry standard.

### Q-04: Mobile chart behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Same page, responsive | Adapts to screen width. TradingView LW handles touch natively. | ✓ |
| Simplified mobile view | Stripped-down chart on mobile. More dev work. | |
| No charts on mobile (v1) | "Open on desktop" message. | |

**User's choice:** Same page, responsive
**Notes:** Industry standard.

---

## Technical Indicators

### Q-05: Which indicators in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: MA + RSI | Trend + momentum. Least UI complexity. | |
| Standard: MA + RSI + MACD | Balanced v1 scope. Built into TradingView LW. | |
| Full: MA + RSI + MACD + Bollinger + Volume | Full suite. More UI complexity. Most complete. | ✓ |

**User's choice:** Full suite
**Notes:** All available in TradingView LW out of box.

---

## Drawing Tools

### Q-06: Drawing tools scope for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip — read-only charts | TA-03 and SC-3 deferred. | |
| Basic: trendlines + horizontal lines | Most common. In-session persistence only. | |
| Full drawing suite | Trendlines, annotations, session persistence. Full TA-03 parity. | ✓ |

**User's choice:** Full drawing suite
**Notes:** Meets requirement TA-03 and success criterion SC-3 in v1.

---

## Timeframes & Data

### Q-07: Which timeframe presets for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: 1D, 1W, 1M, 3M, 1Y | 5 buttons. Fastest. | |
| Standard: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y | 7 presets. Standard brokerage range. | ✓ |
| Full: presets + custom date range | Most flexible. Date picker UI complexity. | |

**User's choice:** Standard range
**Notes:** Industry standard.

---

## Real-time Updates & Backend

### Q-08: How should charts update in real-time?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual refresh only | Static chart. Click Refresh for latest. | |
| Auto-refresh on interval | Poll every 10s. Consistent with useQuery. | |
| Live WebSocket updates | Real-time via chart.update(). TradingView LW native. | ✓ |

**User's choice:** Live WebSocket updates
**Notes:** Needs frontend candle aggregation from WS price ticks.

### Q-09: Where should candle data be calculated?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend proxy: new /api/v1/charts | Backend fetches yfinance, caches, returns OHLCV. Consistent with existing arch. | ✓ |
| Frontend-direct yfinance call | Faster but no caching. Rate limit risk. | |
| Backend + server-side indicator calc | Pre-computes indicators. Useful for AI Advisor later. Most complex. | |

**User's choice:** Backend proxy (/api/v1/charts endpoint)
**Notes:** No server-side indicator calc for v1. TradingView LW handles client-side.

---

## States & Error Handling

### Q-10: Loading, error, and no-data states?

| Option | Description | Selected |
|--------|-------------|----------|
| Full skeleton + inline errors | Chart-area skeleton, ErrorBanner on failure. Consistent with app. | ✓ |
| Partial: chart frame + skeleton | Show grid immediately. Cache-aware error. More polished. | |
| Minimal: spinner + toast | Simplest but least informative. | |

**User's choice:** Full skeleton + inline errors
**Notes:** Matches existing ErrorBanner pattern from Phase 2.5.

---

## Claude's Discretion

- Thin React wrapper component design for TradingView LW
- Chart color palette (within dark theme)
- Indicator config panel UX (period inputs, color pickers)
- Drawing toolbar layout and icon set
- Candle aggregation logic from WS price ticks
- Exact API shape for `/api/v1/charts` endpoint
- Loading skeleton design for chart area
- Mobile breakpoint and control repositioning details

## Deferred Ideas

- Additional chart types (Bar, Area, Heikin-Ashi) — future versions
- Custom date range picker — future version
- Server-side indicator calculation — Phase 5 (AI Advisor)
- DB persistence for drawing annotations — session-only for v1
