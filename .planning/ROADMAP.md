# PaperTrade Project Roadmap

**Phases:** 5
**Granularity:** standard
**Coverage:** 24/24 requirements mapped ✓

## Phases

- [ ] **Phase 1: Data Infrastructure** - Reliable real-time multi-asset market data with caching and fault tolerance.
- [ ] **Phase 2: Trading & Portfolio** - Order placement, management, and portfolio tracking.
- [ ] **Phase 3: Charts & Technical Analysis** - Interactive charts with indicators and drawing tools.
- [ ] **Phase 4: External Signals** - Integration of news, social media, and insider data.
- [ ] **Phase 5: AI Advisor** - AI recommendations with explanations and confidence.

## Phase Details

### Phase 1: Data Infrastructure
**Goal**: The system reliably provides real-time market data across all asset classes, with caching, graceful failure, and normalized formats.
**Depends on**: Nothing
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User sees live price updates for all supported assets (stocks, crypto, gold/silver, sports) refreshing every few seconds.
  2. All displayed prices and portfolio values are automatically converted to INR using live exchange rates.
  3. When an external data source fails, the system shows the last known data with a "stale" indicator instead of crashing.
  4. The platform initializes quickly and remains responsive despite high-frequency data updates.
**Plans**: TBD

### Phase 2: Trading & Portfolio
**Goal**: Users can place and manage orders, and view their portfolio's performance, composition, and history.
**Depends on**: Phase 1
**Requirements**: TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05, PORT-01, PORT-02, PORT-03, PORT-04
**Success Criteria** (what must be TRUE):
  1. User can place market, limit, stop loss, and take profit orders, and see them listed under open orders.
  2. User can cancel an open order before it fills.
  3. After an order fills, the user's cash balance, holdings, and overall P&L update instantly and accurately.
  4. User can view a complete trade history with details (date, asset, quantity, price, type) and reset the portfolio to start over.
  5. The portfolio summary shows net worth breakdown and key performance metrics (e.g., total gain/loss, win rate).
**Plans**: TBD
**UI hint**: yes

### Phase 3: Charts & Technical Analysis
**Goal**: Users can analyze asset price movements using interactive charts with technical indicators and drawing tools.
**Depends on**: Phase 1
**Requirements**: TA-01, TA-02, TA-03
**Success Criteria** (what must be TRUE):
  1. User can open an interactive candlestick or line chart for any asset, with zoom/pan and real-time updates.
  2. User can add technical indicators (e.g., moving averages, RSI, MACD) to the chart, which update live.
  3. User can draw trendlines, annotations, and other shapes on the chart, and they persist during the session.
  4. User can switch between chart types and customize timeframes.
**Plans**: TBD
**UI hint**: yes

### Phase 4: External Signals
**Goal**: The system aggregates and displays external market sentiment and insider information to inform trading.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. User can view recent news headlines and an aggregated sentiment score (positive/negative/neutral) for any asset.
  2. User can see social media sentiment trends (from X/Twitter and Reddit) for assets, updated regularly.
  3. User can access a list of recent insider trading activities and SEC filings for stocks.
**Plans**: TBD
**UI hint**: yes

### Phase 5: AI Advisor
**Goal**: Users receive AI-generated buy/sell recommendations with explanations and confidence levels.
**Depends on**: Phase 3, Phase 4
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. While viewing an asset, the user sees an AI recommendation (Buy/Sell/Hold) with a confidence percentage, displayed non-intrusively (sidebar or hover).
  2. Clicking the recommendation reveals a concise explanation of the rationale (e.g., "Bullish divergence detected").
  3. Recommendations update in near real-time as new data (prices, news, sentiment) arrives.
  4. The user can request detailed reasoning to see all factors contributing to the recommendation.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Infrastructure | 0/0 | Not started | - |
| 2. Trading & Portfolio | 0/0 | Not started | - |
| 3. Charts & Technical Analysis | 0/0 | Not started | - |
| 4. External Signals | 0/0 | Not started | - |
| 5. AI Advisor | 0/0 | Not started | - |
