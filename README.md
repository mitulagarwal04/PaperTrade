# PaperTrade

Real-time multi-asset paper trading platform. Built as a sandbox for future automated trading bots.

## Features

- **Multi-asset support**: Stocks, crypto, commodities (extensible architecture)
- **Real-time prices**: WebSocket streaming with 5-second updates
- **Provider fallback**: Automatic failover between data sources (Yahoo Finance → CoinGecko)
- **PG-based caching**: Stale-while-revalidate pattern for resilience
- **AI-ready architecture**: Designed for technical analysis + sentiment signals

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0, PostgreSQL
- **Data Sources**: Yahoo Finance (yfinance), CoinGecko API
- **Real-time**: WebSocket with FastAPI native support
- **Testing**: pytest + pytest-asyncio

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+

### Setup

```bash
# Clone the repo
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL and optional API keys

# Run the app
uvicorn app.main:app --reload

# API will be available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/prices/{symbol}` | GET | Get current price for asset |
| `/api/v1/assets` | GET | List supported assets |
| `/ws/prices` | WebSocket | Real-time price stream |

## Architecture

```
backend/
├── app/
│   ├── config.py          # Pydantic settings
│   ├── database.py        # SQLAlchemy async setup
│   ├── main.py            # FastAPI app with WebSocket
│   ├── api/               # REST routes
│   ├── cache/             # PostgreSQL caching
│   ├── providers/         # Data source abstraction
│   │   ├── base.py        # Provider interface
│   │   ├── yfinance_provider.py
│   │   └── coingecko_provider.py
│   └── websocket/         # Connection manager
└── tests/
```

## Key Design Patterns

- **Provider Abstraction**: Swap data sources without changing consumer code
- **Stale-While-Revalidate**: Return cached data immediately, refresh in background
- **Graceful Degradation**: APIs fail? Return last known price with `is_stale=true`

## License

MIT

## Project Status

- [x] Phase 1: Data Infrastructure - Fund real-time data with caching
- [ ] Phase 2: Trading & Portfolio - Order placement, portfolio tracking
- [ ] Phase 3: Charts & Technical Analysis - Interactive charts, indicators
- [ ] Phase 4: External Signals - News, sentiment, insider data
- [ ] Phase 5: AI Advisor - ML recommendations with explanations
