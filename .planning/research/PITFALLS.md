# Domain Pitfalls

**Domain:** Paper trading platforms (multi-asset, AI advisory)
**Researched:** 2026-04-12

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: API Rate Limit Violations Causing Data Blackouts
**What goes wrong:** Free APIs (CoinGecko, yfinance, Twitter) enforce strict rate limits. Exceeding them results in bans (hours/days), breaking price updates and AI signals.

**Why it happens:** Naïve implementation fetches fresh data on every user action or chart refresh. No caching, no backoff, no fallback sources. Team doesn't know actual limits (undocumented for yfinance).

**Consequences:** Platform appears broken. Stale prices. AI stops making recommendations. Users lose trust. Recovery takes hours/days as IP unban happens.

**Prevention:**
- Implement multi-tier caching: in-memory (5s) → Redis/PostgreSQL cache (60s) → API (when stale)
- Use a **data source abstraction layer** that can route requests to multiple providers (e.g., CoinGecko API + Binance public API + yfinance). Fallback on failure.
- Implement **exponential backoff with jitter** on 429 responses.
- Monitor rate limit headers (if provided) and throttle preemptively.
- Document all API limits in code comments and runbook.
- Consider adding paid API tier before hitting scale; have migration plan.

**Detection:**
- Alerting on 429/403 responses from external APIs
- Monitoring cache hit rates (<80% indicates not caching enough)
- Logging all API failures with timestamps

---

### Pitfall 2: P&L Calculation Errors from Currency Conversion Bugs
**What goes wrong:** Portfolio value and P&L displayed in INR, but assets priced in USD (stocks/crypto) or native currencies. If FX rates are stale or applied incorrectly, P&L becomes inaccurate, undermining core value ("realistic simulation").

**Why it happens:** Developers compute P&L per asset in local currency only, forgetting to convert cost basis. Or use FX rate from time of purchase vs current rate inconsistently. Or fetch FX rates async and use stale cached values without timestamp awareness.

**Consequences:** Users see incorrect profit/loss. Trading decisions based on bad data. Platform criticized as "unrealistic." Hard to track down because bugs are subtle (e.g., off by 0.5%).

**Prevention:**
- Store **all** monetary values in smallest units (cents/paisa) as integers. Never store floats for money.
- Store **cost basis per trade** in asset's native currency + **conversion rate at time of trade**.
- Compute current portfolio value: `value_inr = sum(quantity * current_price_usd * current_fx_inr_per_usd)`
- Compute realized P&L: `(sell_price_usd * sell_fx) - (buy_price_usd * buy_fx)` per trade
- Always use Decimal type, never float.
- Write unit tests covering:
  - Buy at FX rate 83.5, sell at 83.2 → negative currency impact even if asset price unchanged
  - Mixed portfolio: some assets bought at different FX rates
  - Currency conversion precision (round only at display layer)
- Log FX rate source and timestamp with every P&L calculation in dev mode.

**Detection:**
- Compare computed total portfolio value against manual spreadsheet calculation with sample data
- Monitor FX rate update frequency; alert if older than 1 hour
- Unit test coverage must include cross-currency scenarios

---

### Pitfall 3: Order Execution State Machine Flaws
**What goes wrong:** Orders get stuck in "pending" or incorrectly marked as "filled" after partial fills or API timeouts. Duplicate orders execute. Cancellation requests ignored.

**Why it happens:** Complex async flows: user clicks Buy → backend calls exchange API → network error → response lost → UI shows "pending" indefinitely. No timeout/retry. No idempotency keys to prevent duplicate fills.

**Consequences:** Users think order didn't go through and retry → double position. Or order hung → user frustrated. Debugging requires log spelunking through API responses.

**Prevention:**
- Implement explicit **order state machine** with states: `PENDING` → `SENT_TO_API` → `CONFIRMED` / `FAILED` / `PARTIAL` → `FILLED` / `CANCELLED`. Never skip states.
- Use **idempotency keys**: each order gets UUID. If retry with same UUID, exchange should reject duplicate (many APIs support this).
- Implement **timeout and retry logic**: after 30s pending, raise flag. Auto-cancel after 60s pending unless partial fill.
- **Persist order state to DB immediately** upon user submission (before API call). Show "processing" not "pending".
- After API call, **update state atomically** with DB write.
- Provide manual "force cancel" and "force fill" admin actions (for debugging).
- Log every state transition with timestamp and API response.

**Detection:**
- Dashboard of orders in non-terminal states for >5 minutes
- Alert on order ID reuse
- End-to-end tests simulating network failures

---

### Pitfall 4: Data Source Unavailability for Certain Asset Classes
**What goes wrong:** Designed for 4 asset classes, but sports prediction markets have no free, reliable data source. Commodities API limits hit immediately. Platform can't actually deliver promised features.

**Why it happens:** Assumption that "Polymarket-style" data can be scraped or accessed freely. No validation during research phase. Commitment to scope before verifying feasibility.

**Consequences:** Feature promised but can't be built. Must cut scope mid-project or pay for API (budget violation). User disappointment.

**Prevention:**
- **Spike before Phase 3**: Dedicate 1 week to data sourcing discovery for commodities and sports markets. Verify:
  - Free gold/silver API with real-time updates (e.g., goldapi.io free tier? metals.live?)
  - Prediction market data: Can we scrape Polymarket? Is there RSS? Any public API? Rate limits?
- **Disable assets by default** until data feed confirmed working. Show "Data unavailable" message, not broken UI.
- **Design asset class abstraction** from day one so adding/removing classes is simple.
- **Escalate immediately** if data source found but rate limits make it unusable—consider paid tier budget or dropping class.

**Detection:**
- Automated daily check: fetch sample data for each asset class; alert on failure
- Health check endpoint per data source

---

### Pitfall 5: AI Black Box Undermining Trust
**What goes wrong:** AI recommendations appear with no explanation ("BUY BTC NOW"). Users skeptical; product positioned as "glorified random number generator."

**Why it happens:** Team uses complex ML model (neural network) with no interpretability. Or throws scraps of indicators ("RSI=34") without synthesis. Or recommendations change erratically on small price moves.

**Consequences:** Core differentiator becomes liability. Users ignore AI panel. Product fails to deliver "advisor" value.

**Prevention:**
- **Rule-based first**: Build transparent decision tree: "BUY signal because: 1) MACD crossed above signal line (bullish), 2) RSI=31 (oversold), 3) News sentiment: +0.4 (positive)."
- If ML later, use **explainable models**: decision trees, linear models with feature importance, SHAP values. Never use deep learning without attention/explainability layer.
- **Show confidence score**: Low/Medium/High based on indicator agreement.
- **Show conflicting signals**: "RSI says oversold (buy), but MACD still bearish. Wait."
- **Link to source**: "Based on news from CoinDesk, 2 hours ago: [headline]"
- **User feedback loop**: "Was this recommendation helpful?" → tune model/rules.

**Detection:**
- User testing: "Do you trust the AI panel?" Likert scale
- A/B test: rule-based explanations vs no explanations → measure click-through and trade follow-through

---

### Pitfall 6: Testing Against Live APIs Makes Tests Flaky
**What goes wrong:** Integration tests call real yfinance/CoinGecko APIs. Tests pass sometimes, fail others due to rate limits, network blips, or data changes. Developers disable tests. No test coverage.

**Why it happens:** Convenience of "just use real data." Lack of test data mocking strategy. Belief that "we need to test real integration anyway."

**Consequences:** Flaky CI/CD pipeline. False positives/negatives. Teams lose trust in tests and stop running them. Regression bugs slip through.

**Prevention:**
- **Mock all external APIs** in tests. Use `pytest-mock` or `responses` library.
- Store **sample JSON responses** from real APIs in `tests/fixtures/`. Update quarterly as data schema changes.
- **Separate integration tests** for paid/trusted APIs (if any). Run less frequently (nightly), not on every PR.
- Implement **contract tests**: ensure your data source abstraction layer handles all expected API response shapes, error cases (429, 500, malformed JSON).
- **VCR.py approach**: Record real API interactions, replay in tests. Good for occasional realism without flakiness.
- Never test rate limit handling by actually hitting limits. Mock 429 responses.

**Detection:**
- CI pipeline: all tests must pass consistently. Flaky test detection tools.
- Code review check: all tests mocking external dependencies?

---

## Moderate Pitfalls

### Pitfall 1: Single-User Assumption Leads to Hidden Coupling
**What goes wrong:** Code assumes only one user exists globally. Hardcoded "current user" globals. Database tables lack user_id columns. Later, when adding multi-user, requires massive refactor.

**Why it happens:** "v1 is single-user" misinterpreted as "no user concept ever." Developers skip user_id foreign keys because "only one user."

**Prevention:** Even for single-user, **design data model as if multi-user**:
- Include `user_id` in all tables (even if always = 1)
- Keep session/auth abstraction (even if stub implementation)
- Isolate user data in queries: `SELECT * FROM portfolios WHERE user_id = :current_user`
- Document: "All tables are user-scoped. Single-user v1 sets user_id=1 always."
This makes v2 multi-user a configuration change, not rewrite.

**Detection:** Code review: check all queries have user_id filter.

---

### Pitfall 2: Assuming Stable Schema from Free APIs
**What goes wrong:** Code tightly couples to yfinance response shape. When Yahoo adds/removes fields, app crashes on startup. Or CoinGecko changes pagination format.

**Why it happens:** No data validation layer. Trust external APIs to be stable. No adapter pattern.

**Prevention:**
- **Adapter layer per data source**: convert raw API response to internal canonical model. Isolate parsing logic.
- **Schema validation**: Use Pydantic (Python) or Zod (TypeScript) to validate every API response. Fail fast with clear error if upstream changed.
- **Alert on new fields**: Log unexpected keys in API responses; investigate before ignoring.
- **Version API endpoints** if possible (some APIs support versioning).

**Detection:**
- Monitor logs for "unexpected field" warnings
- Weekly smoke test: fetch sample data from all sources; alert on validation failures

---

### Pitfall 3: INR Base Currency Introduces Hidden Decimal Bugs
**What goes wrong:** P&L displayed in INR but calculated in USD then converted. Rounding at wrong step introduces ±1-2 INR errors per trade. Accumulates to noticeable discrepancies.

**Why it happens:** Developers treat currencies naively. Convert USD→INR, round to 2 decimals immediately. Then sum rounded values → rounding error. Or display rounding differs from calculation precision.

**Prevention:**
- **Rule**: All internal calculations in **integer paisa** (1 INR = 100 paisa). Convert everything to paisa immediately after FX conversion: `usd_value = 100.50 USD * fx 83.45 = 8388.4725 INR → 8388 paisa (round down? nearest?)** document rounding policy.
- **Display only** rounds to 2 decimals (standard INR formatting).
- **Audit trail**: Store both raw decimal and rounded display value for debugging.
- **Test**: 100 trades with fractional paisa amounts → ensure final portfolio matches manual calculation to within 1 INR.

**Detection:**
- Reconciliation: sum of all trade P&Ls should equal current portfolio value minus initial capital (allow ±0.01 INR tolerance)

---

### Pitfall 4: Real-time Updates Block UI When API Calls Slow
**What goes wrong:** User opens platform → charts fetch data → 3 independent data calls run sequentially → UI frozen for 5 seconds. User thinks it's broken.

**Why it happens:** Frontend awaits one fetch before starting next. Or uses synchronous API calls in React component mount. No loading states.

**Prevention:**
- **Parallel fetching**: All data sources independent? Fetch concurrently with `Promise.all()` or `asyncio.gather()`.
- **Skeleton UI**: Show placeholders while data loads.
- **Progressive loading**: Chart loads first, AI panel second, screener last.
- **WebSocket push**: Server pushes updates; client doesn't poll.
- **Cache warm**: On page load, serve cached data immediately, then refresh in background.

**Detection:**
- Lighthouse performance scores
- User testing: time-to-interactive benchmark < 2s

---

## Minor Pitfalls

### Pitfall 1: Timezone Chaos in Trade Timestamps
**Problem:** Trade timestamps from APIs in UTC. Display to user in local IST. Comparison logic (day-wise P&L) uses mismatched timezone.

**Prevention:** Store all datetimes in UTC (ISO 8601). Convert to IST only at display layer. Use timezone-aware datetime objects (Python `pytz` or `zoneinfo`).

---

### Pitfall 2: Hardcoded Asset Lists Break When New Symbols Listed
**Problem:** Code assumes Bitcoin symbol = "BTC-USD" (yfinance) or "bitcoin" (CoinGecko). When exchange adds new ticker format, code fails.

**Prevention:** Mapping table: `Asset → { yfinance_symbol, coingecko_id, twelvedata_symbol }`. Externalize to config file or database. Update mapping when new asset added, don't change code.

---

### Pitfall 3: Ignoring Market Hours Causes Invalid Order Errors
**Problem:** User tries to trade Indian stock after NSE closes. API rejects order. Platform doesn't explain why.

**Prevention:** Show market status per asset class: "NSE closed until 9:15 AM IST" or "Crypto markets open 24/7." Disable order button or explain reason for rejection.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|------------|----------------|------------|
| **Data ingestion** | Single API provider dependency | Build abstraction layer from day one; at least 2 sources per asset class |
| **Order execution** | No idempotency → duplicate fills | Generate UUID per order; store; retry with same UUID on network failure |
| **AI recommendations** | Overfitting to past data | Paper trade with simulated future data; keep rules simple and robust |
| **Currency conversion** | Float arithmetic → rounding errors | Use Decimal or integer paisa; unit tests with extreme values |
| **Sports markets** | Data unavailable after commitment | Spike in Phase 2; disable UI until source confirmed |
| **Real-time updates** | WebSocket connection leaks | Implement heartbeats; auto-reconnect; close connections on component unmount |
| **Portfolio reset** | Foreign key constraints prevent delete | Use CASCADE deletes or soft-delete with active flag |
| **Screener** | N+1 query performance issue | Eager load with joins; cache asset metadata (price, market cap) separately |

---

## Monitoring & Alerting Checklist

Must-have alerts in Phase 1:
- [ ] API rate limit approaching (80% of quota)
- [ ] Order stuck in PENDING > 2 minutes
- [ ] Data source failed to fetch for > 5 minutes
- [ ] Database connection pool exhaustion
- [ ] FX rate stale > 1 hour
- [ ] Unhandled exception rate > 5/minute

---

## Sources

- Trading platform reliability post-mortems ( outages at Robinhood, Coinbase, Binance )
- Free API rate limit documentation (CoinGecko, yfinance, Alpha Vantage)
- Currency conversion precision issues in fintech (double rounding problems)
- WebSocket connection management best practices
- **CONFIDENCE LEVEL: HIGH** for critical pitfalls (API limits, order state, P&L bugs). These are universal in trading systems.
- **CONFIDENCE LEVEL: MEDIUM** for asset-class specific pitfalls (sports data availability) — needs validation spike.
