# PaperTrade

## What This Is

Real-time multi-asset paper trading platform. Serves as sandbox for future automated trading bot. Supports equities, crypto, commodities, and sports/prediction markets (Polymarket-style). AI advisor uses technical analysis plus news, social media sentiment, and insider/CEO trading signals. Starting capital 100K INR with currency auto-conversion. Single-user for now, designed to scale.

## Core Value

Realistic trading simulation with accurate real-time prices and AI guidance. Must execute trades correctly and reflect portfolio positions reliably. Everything else secondary.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-asset real-time market data (stocks, crypto, gold/silver, sports prediction markets)
- [ ] Interactive price charts with technical indicators
- [ ] Order placement: market, limit, stop loss, take profit
- [ ] Portfolio view: holdings, cash balance, P&L, trade history
- [ ] AI buy/sell recommendations with explanations
- [ ] Non-intrusive advisory UI (sidebar/hover icons)
- [ ] Screener page listing assets with key metrics
- [ ] External signals: news sentiment, social media (X/Twitter, Reddit), SEC/insider trades (free sources only)
- [ ] INR base currency with live exchange rate conversion
- [ ] Portfolio reset capability

### Out of Scope

- Multi-user authentication and accounts (single-user only for v1)
- Paid API integrations (use free APIs first, upgrade post-v1)
- Mobile app (web only)
- Social features (leaderboards, sharing)
- Advanced portfolio optimization (v2)
- Traditional sports betting odds (focus on binary prediction markets)

## Context

User is developing an automated trading bot for real markets. PaperTrade is the testing ground. Must simulate real market behavior: pricing, latency, order execution. Stack: Python backend, PostgreSQL database, frontend flexible (React/Vue/Svelte). All data from free public APIs (yfinance, CoinGecko, etc.). Real-time target latency: seconds. Starting bankroll 100K INR.

## Constraints

- Use only free APIs for v1; paid integrations deferred
- Single-user, no auth required
- Real-time data updates every few seconds
- Currency conversion must use live rates
- AI recommendations must include reasoning (interpretability)
- UI must remain uncluttered
- Must support at least equities and crypto reliably; commodities and sports if free data available

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Free APIs first | Validate concept before spending | Pending |
| Backend in Python | User preference, good for AI/ML | Pending |
| DB: PostgreSQL | Relational data, user preference | Pending |
| Single-user v1 | Simplicity, faster build | Pending |
| Advisory panel UI | Non-cluttered guidance | Pending |
| All asset classes | Comprehensive coverage | Pending |
| Polymarket preference | Arbitrage focus | Pending |
| SEC/insider data | Include if free APIs exist | Pending |
| INR base currency | User location | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state (users, feedback, metrics)

---

*Last updated: 2026-04-12 after initialization*
