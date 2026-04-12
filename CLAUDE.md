<!-- GSD:project-start source:PROJECT.md -->
## Project

**PaperTrade**

Real-time multi-asset paper trading platform. Serves as sandbox for future automated trading bot. Supports equities, crypto, commodities, and sports/prediction markets (Polymarket-style). AI advisor uses technical analysis plus news, social media sentiment, and insider/CEO trading signals. Starting capital 100K INR with currency auto-conversion. Single-user for now, designed to scale.

**Core Value:** Realistic trading simulation with accurate real-time prices and AI guidance. Must execute trades correctly and reflect portfolio positions reliably. Everything else secondary.

### Constraints

- Use only free APIs for v1; paid integrations deferred
- Single-user, no auth required
- Real-time data updates every few seconds
- Currency conversion must use live rates
- AI recommendations must include reasoning (interpretability)
- UI must remain uncluttered
- Must support at least equities and crypto reliably; commodities and sports if free data available
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Backend Core
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.11+ | Backend runtime | User preference + excellent AI/ML ecosystem (scikit-learn, pandas, numpy). Async support (asyncio) for concurrent data fetching. |
| FastAPI | 0.115+ | REST API framework | Auto-documentation, async-first, type hints, Pydantic validation. Better than Flask for real-time features. |
| PostgreSQL | 15+ | Primary database | ACID guarantees for order/portfolio consistency. JSONB for flexible signal storage. Relational integrity crucial for financial data. |
| SQLAlchemy | 2.0+ | ORM + query builder | Declarative models, connection pooling, migration support with Alembic. |
### Frontend Core
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18+ (with hooks) | UI framework | User choice per PROJECT.md "flexible". Vue/Svelte acceptable alternatives. React ecosystem largest, many charting libraries. |
| TypeScript | 5.x | Type safety | Essential for financial calculations. Catch bugs at compile time. |
| Vite | 5.x | Build tool | Fast dev server, HMR, simple config. Better than CRA. |
| TailwindCSS | 3.x | Styling | Utility-first, enables quick prototyping. Matches "uncluttered UI" requirement. |
| Recharts / Chart.js | Latest | Charting library | Recharts (React-friendly) or Chart.js (framework-agnostic). Support candlesticks, indicators overlay. TradingView Lightweight Charts alternative if more advanced needed. |
### Real-time & Data
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WebSockets (FastAPI) | Built-in | Real-time price pushes | Polling every 5-10s acceptable v1, but WebSockets better UX. FastAPI supports native WebSocket connections. |
| Redis (optional) | 7+ | Caching layer | Mitigate API rate limits. Cache market data for 5-10s, FX rates for 1min, signals for 5min. Only if PostgreSQL caching insufficient. |
| Celery + Redis | 5.x | Background tasks | Async signal fetching, batch API calls, scheduled data refresh. Decouples ingestion from API response path. |
### AI/ML & Signals
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| scikit-learn | 1.5+ | ML models (optional) | For v1, start rule-based. If ML needed later, scikit-learn provides simple classifiers/regressors with good explainability (feature importance). |
| pandas | 2.x | Data manipulation | Essential for technical indicator calculations, OHLC resampling, P&L aggregations. |
| TextBlob / VADER | Latest | Sentiment analysis | Simple NLP for news/social sentiment. Free, no API keys, decent accuracy for prototyping. Not state-of-the-art but sufficient for v1. |
| Requests + aiohttp | Latest | External API calls | Fetch free data sources. aiohttp for async concurrent fetching to minimize latency. |
### Data Sources (Free APIs)
| Source | Data Provided | Rate Limits | Notes |
|--------|---------------|-------------|-------|
| Yahoo Finance (yfinance) | Equities, ETFs, indices, some crypto | Undocumented, throttles | Most comprehensive free source. May need to rotate user-agents and implement exponential backoff. |
| CoinGecko | Crypto (1000+ coins) | 10-30 calls/min free tier | Requires API key now? Check current policy. Aggressive caching mandatory. |
| Alpha Vantage (free tier) | Equities, forex, crypto, technical indicators | 5 calls/min, 500/day | Limited but reliable. Good backup/validation source. |
| Twelve Data (free tier) | Equities, forex, crypto, commodities | 8 calls/min | Limited. Check if commodities available. |
| FRED API | Economic data (inflation, rates) | Unlimited with key | Free, good for macro context. Optional. |
| SEC EDGAR | Insider trades, filings | Unlimited | Bulk RSS feeds available. Parse with BeautifulSoup/XML. Key for insider signal. |
| Twitter/X API (free) | Social sentiment | 500k tweets/month read-only | Requires developer account. Rate limits tight. Cache aggressively. |
| Reddit JSON | Subreddit posts/comments | Unlimited (public JSON) | Use PRAW or direct JSON scraping. Good for crypto/stock sentiment subs. |
| Bank of India / RBI API | INR to USD FX rates | Unknown | Need to identify free source. XE.com, ECB, or IMF alternatives. |
| Polymarket / PredictIt | Prediction market odds | Unknown | Most challenging. May need to scrape. Check if public API exists or use RSS. Likely require custom parser. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | FastAPI | Flask | FastAPI async better for concurrent data fetching; automatic doc saves time. |
| Frontend framework | React | Vue/Svelte | React chosen arbitrarily; Vue/Svelte equally valid. Team familiarity should decide. |
| Charting library | Recharts | TradingView Lightweight Charts | TradingView more powerful but licensing? Recharts simpler, sufficient for v1. |
| DB | PostgreSQL | MongoDB | Financial data needs ACID and joins. MongoDB OK but relational safer for transactions. |
| Cache layer | Redis (optional) | PostgreSQL materialized views | Redis faster, but introduce extra dependency. Start with PostgreSQL cache tables; add Redis only if needed. |
| AI approach | Rule-based + simple ML | Full LLM integration (Claude API) | LLMs cost money and lack explainability. Rule-based is interpretable, cheaper, sufficient for v1. |
| Signal NLP | TextBlob/VADER | Transformers (HuggingFace) | Transformers more accurate but slower, larger. VADER works well for finance social sentiment. |
| Real-time | WebSockets | Server-Sent Events (SSE) | SSE simpler but unidirectional. WebSockets allow two-way (client can request asset refresh). |
| Task queue | Celery | RQ (Redis Queue) | Celery more battle-tested, feature-rich. RQ simpler but Celery scales better. |
## Installation
# Backend
# Frontend
# Database
# Install PostgreSQL locally or use Docker:
## Environment Variables (Backend)
# Required
# API Keys (all have free tiers)
# Tuning
## Sources
- FastAPI documentation: https://fastapi.tiangolo.com/
- PostgreSQL best practices for financial data: https://www.postgresql.org/docs/current/
- Free API comparisons for market data (trading community forums, 2024)
- Trading platform architecture patterns (broker-dealer systems, fintech blogs)
- **CONFIDENCE LEVEL: HIGH** for stack selection, MEDIUM for specific API coverage—must verify rate limits and data completeness in Phase 0 discovery.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
