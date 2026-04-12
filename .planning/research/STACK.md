# Technology Stack

**Project:** PaperTrade — Multi-asset paper trading with AI advisory
**Researched:** 2026-04-12
**Constraint:** Free/public APIs only for v1

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

---

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

---

## Installation

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install fastapi uvicorn sqlalchemy psycopg2-binary pandas aiohttp requests textblob celery redis alembic
pip install yfinance alpha-vantage twelvedata  # data source clients

# Frontend
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install recharts axios

# Database
# Install PostgreSQL locally or use Docker:
docker run --name papertrade-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
createdb papertrade
```

---

## Environment Variables (Backend)

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/papertrade
SECRET_KEY=your-secret-key-for-sessions  # if auth added later

# API Keys (all have free tiers)
YFINANCE_ENABLED=true  # no key needed but consider rotating user-agents
COINGECKO_API_KEY=optional  # if rate limits need higher tier
ALPHA_VANTAGE_API_KEY=free_key_here
TWELVE_DATA_API_KEY=free_key_here
SEC_EDGAR_USER_AGENT="PaperTrade/1.0 (your-email@example.com)"
TWITTER_BEARER_TOKEN=free_tier_token  # if using Twitter
REDDIT_CLIENT_ID=optional  # if using PRAW
FX_API_URL=https://api.exchangerate-api.com/v4/latest/USD  # free FX API candidate

# Tuning
PRICE_UPDATE_INTERVAL_SECONDS=10
CACHE_TTL_SECONDS=60
MAX_CONCURRENT_API_CALLS=10
```

---

## Sources

- FastAPI documentation: https://fastapi.tiangolo.com/
- PostgreSQL best practices for financial data: https://www.postgresql.org/docs/current/
- Free API comparisons for market data (trading community forums, 2024)
- Trading platform architecture patterns (broker-dealer systems, fintech blogs)
- **CONFIDENCE LEVEL: HIGH** for stack selection, MEDIUM for specific API coverage—must verify rate limits and data completeness in Phase 0 discovery.
