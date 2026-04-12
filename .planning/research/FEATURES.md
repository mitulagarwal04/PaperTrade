# Feature Landscape

**Domain:** Multi-asset paper trading platform with AI advisory
**Researched:** 2026-04-12

## Executive Summary

Trading platforms have a well-defined feature hierarchy. **Table stakes** are features users expect by default—missing them makes the platform feel incomplete or unusable. **Differentiators** are competitive advantages that attract users but aren't strictly required. **Anti-features** are capabilities that introduce unnecessary complexity, risk, or maintenance burden for the current scope.

For PaperTrade's v1 (single-user, free APIs, multi-asset), we must deliver all table stakes reliably, carefully select 1-2 differentiators that align with the AI advisory thesis, and explicitly avoid features outside the defined scope.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time market data | Trading requires current prices | Low-Medium | Free APIs (yfinance, CoinGecko) sufficient for v1. Update frequency: 5-10 seconds acceptable for paper trading. |
| Basic order types (market, limit) | Core trading functionality | Medium | Market orders for immediate execution; limit orders for price control. Must support all asset classes. |
| Order execution & confirmation | Users must trust trades execute | Medium | Must handle API rate limits, network failures, and provide explicit success/failure feedback. |
| Portfolio view (holdings + cash balance) | Users need to see their positions | Low | Simple aggregation. Must show quantity, average cost, current value per asset. |
| P&L tracking (realized + unrealized) | Performance measurement | Medium | Requires accurate cost basis tracking, including currency conversion for non-USD assets. |
| Trade history log | Audit trail and tax reporting foundation | Low | Immutable record of all trades with timestamps, prices, quantities, fees. |
| Basic candlestick charts | Visual price analysis expected | Low-Medium | OHLC data from APIs. Minimum requirement: 1D, 1W timeframes. |
| Currency conversion (multi-currency support) | Multi-asset platforms must handle base currency | Medium | For INR base with USD-denominated assets, need live FX rates. Critical for accurate P&L. |
| Portfolio reset capability | Paper trading requires do-overs | Low | Simple "reset to initial capital" button. Must clear all holdings and history. |
| Screener/filtering page | Users need to discover assets | Medium | Basic filters: price change %, volume, market cap, asset class. |
| Transaction fees simulation | Realism in trading costs | Low | Fixed percentage or tiered fees. Must impact P&L calculations. |
| Error handling & rollback | Trade failures must not corrupt state | Medium | Failed orders must not deduct cash. Partial fills must be handled gracefully. |
| Data persistence | State must survive page refresh | Low | PostgreSQL recommended for ACID guarantees. |
| Responsive UI (desktop + tablet) | Users trade on multiple devices | Low | Mobile deferred to v2 per out-of-scope. |

---

## Differentiators

Features that set product apart. Not expected, but valuable for competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI buy/sell recommendations with explanations** | Core differentiator. Attracts users seeking guidance. | High | Must include reasoning (technical indicators, sentiment, signals). Explainable AI critical—no black boxes. Use free ML models or rule-based systems for v1. |
| **External signal integration (news, social media, insider trades)** | Unique edge: "AI advisor that sees everything" | High | Aggregates free sources: RSS news feeds, X/Twitter API (free tier), Reddit JSON, SEC EDGAR. Sentiment analysis required. |
| **Advanced technical indicators** | Professional-grade analysis tools | Medium | 20+ indicators: RSI, MACD, Bollinger Bands, moving averages, Ichimoku. Overlay on charts. Caching heavy calculations recommended. |
| **Multiple simultaneous charts** | Compare assets side-by-side | Medium | Essential for multi-asset strategy. One chart per asset class (stock, crypto, commodity, prediction market). |
| **Customizable dashboard layout** | Personalization for power users | Low-Medium | Drag-and-drop widgets: portfolio, charts, screener, AI panel, news feed. |
| **Price alerts & notifications** | Proactive monitoring | Low-Medium | Triggered on price levels, indicator crossovers, or AI-generated signals. In-app + email. |
| **Watchlists** | Track assets without holding them | Low | User-defined lists. Sync across sessions. |
| **Strategy backtesting framework** | Validate AI recommendations historically | High | Replay historical data through strategy rules. Report win rate, Sharpe ratio, max drawdown. Big undertaking—consider v2. |
| **Export trade data (CSV/PDF)** | Tax reporting and external analysis | Low | Standard reports: trade log, P&L statement, cost basis report. |
| **Dark mode** | User preference and eye comfort | Low | Industry standard. Easy to implement. |
| **Theme customization** | Personal branding feel | Low | Colors, chart styles. Low priority but easy. |
| **Multi-language support** | Global accessibility | Medium | English only for v1. Consider Hindi for PaperTrade's INR audience in v2. |
| **Keyboard shortcuts** | Speed for active traders | Low-Medium | Space for buy, Ctrl+Space for sell, arrow keys for navigation. |
| **Real-time portfolio correlation analysis** | Diversification insights | High | Compute correlation matrix across asset classes. Help users understand portfolio risk. Non-trivial math. |
| **Sports prediction market specific features** | Polymarket differentiation | Medium-High | Yes/No binary outcomes displayed clearly, probability (%) display, event expiry dates, volume-weighted prices, liquidity indicators. |

---

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-user authentication & accounts** | Scope creep. v1 is single-user tool for personal testing. | Add basic auth only if user accesses from multiple devices. Delay until v2. |
| **Mobile apps (iOS/Android)** | Web-only per project constraints. | Use responsive web design. PWA can be considered later. |
| **Social features (leaderboards, sharing, following)** | Out of scope per PROJECT.md. Adds moderation complexity. | Keep platform isolated. Social features in v2 if desired. |
| **Paid API integrations** | Constraint: free APIs only for v1. | Monitor API limits and upgrade proactively but not before v1 validation. |
| **Options/futures/derivatives trading** | Overcomplicates core trading. Different asset class with unique risks. | Support spot markets only. v2 can explore if needed. |
| **Margin trading & leverage** | Introduces counterparty risk and liquidation complexity. | Cash-only accounts. No borrowing. |
| **Short selling** | Requires borrow mechanics and unlimited loss risk. | Long positions only. |
| **Advanced order types (OCO, bracket, trailing stop)** | Nice-to-have but adds UI complexity. | Implement stop-loss and take-profit only. Trail stops in v2. |
| **Real-time collaborative trading** | Multi-user tech debt. | Single-user only. |
| **API access for external bots** | Not needed; this IS the bot's testing ground. | Manual trading only. Automated execution via separate bot process discussed in v2. |
| **Complex portfolio optimization (Mean-Variance, Black-Litterman)** | v2 feature per PROJECT.md. | Simple diversification suggestions only (e.g., "too concentrated in crypto"). |
| **Tax lot accounting (FIFO/LIFO/Specific ID)** | Overkill for paper trading. | Simple average cost basis only. |
| **Enterprise-grade security (SOC2, encryption-at-rest)** | Single-user tool, no sensitive personal data. | Basic auth if added; standard PostgreSQL security sufficient. |
| **SMS/phone 2FA** | Adds friction and dependency. | Email-based recovery only if auth added. |
| **Traditional sports betting odds (moneyline, spread, over/under)** | PROJECT.md: focus on binary prediction markets. | Yes/No outcomes only. |
| **Fiat on/off ramps** | v1 is paper trading simulation only. | No real money movement. |
| **Brokerage integration (connect real brokerage accounts)** | v2 consideration. | Standalone platform. |

---

## Feature Dependencies

```
Data Persistence (PostgreSQL)
    ├─ Portfolio View
    ├─ Trade History
    ├─ P&L Tracking
    └─ Order History

Real-time Market Data
    ├─ Basic Charts
    ├─ Screener
    ├─ AI Recommendations (signals from price data)
    └─ Price Alerts

Order Types (Market + Limit)
    └─ Advanced Order Types (Stop-Loss, Take-Profit)

Basic Charting
    ├─ Advanced Indicators
    └─ Customizable Dashboard

Currency Conversion Module
    ├─ Accurate P&L (in base currency)
    └─ Portfolio Valuation

External Signal Integration
    └─ AI Recommendations (multi-source reasoning)

Portfolio Reset
    └─ Trade History (must clear)

Dark Mode
    └─ Basic UI (theming layer)

Watchlists
    └─ Screener (can't filter without data)

AI Recommendations
    ├─ Technical Analysis (price + indicators)
    ├─ News/Sentiment Integration
    └─ Insider Trade Signals
```

---

## MVP Recommendation

Prioritize in this order:

1. **Real-time market data** (all 4 asset classes) + **Basic order placement** (market, limit) → establish core trading loop
2. **Portfolio view** + **P&L tracking** + **Trade history** → show positions and performance
3. **Basic candlestick charts** → visual confirmation
4. **Currency conversion** (INR base) → accurate valuation
5. **Screener page** → asset discovery
6. **AI recommendations panel** (simple rule-based initially) → differentiate from competitors
7. **External signal integration** (news feed + sentiment) → enhance AI reasoning
8. **Portfolio reset** → sandbox functionality

**Defer to v2:**
- Advanced order types (stop-loss, take-profit) if MVP proves too complex
- Backtesting framework (high complexity)
- Multi-asset correlation analysis (high complexity)
- Social features (out of scope)
- Mobile app (out of scope)

**Minimum Viable Product Definition:**
A single-user can see real-time prices, place market/limit orders, view their portfolio and P&L in INR, and receive AI buy/sell recommendations with basic reasoning. The platform resets cleanly. That's v1 success.

---

## Asset-Class Specific Requirements

### Stocks (Equities)
- Table stakes: OHLC, volume, dividends (if available), split adjustments
- Differentiators: Earnings calendar, SEC filings, insider trading data
- Anti-features: Options chain, short interest data (too advanced)

### Crypto
- Table stakes: 24h volume, circulating supply, market cap, chain data (only if free)
- Differentiators: On-chain metrics (glassnode-style, if free), whale wallet tracking, exchange flows
- Anti-features: Staking rewards, gas fee optimization (v2)

### Commodities (Gold/Silver)
- Table stakes: Spot price, futures curve (if available), USD-denominated
- Differentiators: Inventory reports (gold ETF holdings), mining production data
- Anti-features: Futures contract roll mechanics (too complex)

### Sports Prediction Markets
- Table stakes: Yes/No binary outcomes, probability %, volume, liquidity, event expiry
- Differentiators: Related event correlations (e.g., player injury affecting team outcome), historical probability trends
- Anti-features: Parlay/accumulator bets (different product type)

---

## Complexity Assessment Summary

- **Low complexity (≤2 weeks):** Basic charting, screener, watchlists, trade history, portfolio reset, dark mode, export features
- **Medium complexity (2-4 weeks):** Order execution engine, P&L tracking with currency conversion, advanced indicators, price alerts, dashboard customization
- **High complexity (≥4 weeks):** AI recommendations with explainability, external signal aggregation (sentiment analysis), backtesting engine, correlation analysis

**Total v1 estimated effort:** 12-16 weeks for solo developer with Python backend and modern frontend framework.

---

## Sources

- Industry knowledge from trading platform patterns (TradingView, Thinkorswim, Robinhood, Polymarket)
- Best practices from fintech UX studies
- Common feature sets across paper trading platforms (PaperTrader, TradingPaper, etoro demo)
- Polymarket and prediction market platform analysis (2024-2025)
- CONFIDENCE LEVEL: **MEDIUM** — based on established patterns; lacking 2025-specific market research due to tool limitations. Recommend validating with user interviews and competitor analysis before final roadmap commit.

---

## Research Gaps

1. **No direct competitor analysis** — didn't survey current paper trading platforms' exact feature sets in 2025
2. **No user validation** — assumed table stakes without user interviews
3. **AI recommendation feasibility** — complexity of explainable AI with free APIs unclear; needs proof-of-concept
4. **API rate limit impact** — free API constraints may force different architecture; needs deeper technical research
5. **Prediction market data availability** — unsure if Polymarket-style data can be scraped/accessed freely; needs v1 discovery phase

**Recommendation:** Use this FEATURES.md as a starting hypothesis. Flag AI, external signals, and sports prediction markets for deeper technical feasibility research in Phase 1.
