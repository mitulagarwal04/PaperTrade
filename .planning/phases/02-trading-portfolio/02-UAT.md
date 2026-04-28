---
status: testing
phase: 02-trading-portfolio
source:
  - backend/app/models/order.py
  - backend/app/models/portfolio.py
  - backend/app/services/execution_service.py
  - backend/app/services/order_service.py
  - backend/app/services/portfolio_service.py
  - backend/app/tasks/order_monitor.py
  - backend/app/api/routes/orders.py
  - backend/app/api/routes/portfolio.py
started: 2026-04-21T21:45:00Z
updated: 2026-04-21T21:45:00Z
---

## Current Test

number: 2
name: Place Market Sell Order
expected: |
  POST /api/v1/orders {"symbol": "AAPL", "side": "SELL", "order_type": "MARKET", "quantity": 1}
  Returns 201 Created with order status FILLED
  FIFO lot consumed, realized P&L calculated
  Cash balance increased by sale proceeds
awaiting: user response

## Tests

### 1. Place Market Buy Order
expected: |
  POST /api/v1/orders {"symbol": "AAPL", "side": "BUY", "order_type": "MARKET", "quantity": 1}
  Returns 201 Created with order status FILLED
  Cash balance decreased by ~12,450 INR (1 share × 150 USD × 83 INR/USD)
  Portfolio lot created for AAPL with quantity 1
result: pass
completed_at: 2026-04-21T21:48:00Z

### 2. Place Market Sell Order
expected: |
  POST /api/v1/orders {"symbol": "AAPL", "side": "SELL", "order_type": "MARKET", "quantity": 1}
  Returns 201 Created with order status FILLED
  FIFO lot consumed, realized P&L calculated
  Cash balance increased by sale proceeds
result: pending

### 3. Place Limit Order
expected: |
  POST /api/v1/orders {"symbol": "AAPL", "side": "BUY", "order_type": "LIMIT", "quantity": 1, "price": 140}
  Returns 201 Created with order status OPEN
  Cash reserved, order remains open until price drops
result: pending

### 4. Cancel Open Order
expected: |
  DELETE /api/v1/orders/{id} for an OPEN limit order
  Returns 200 OK with status CANCELLED
  Reserved cash released back to available balance
result: pending

### 5. View Portfolio Summary
expected: |
  GET /api/v1/portfolio
  Returns cash INR, positions value INR, total value INR
  Realized P&L, unrealized P&L, win rate, avg gain/loss
  List of positions with current prices and P&L
result: pending

### 6. View Trade History
expected: |
  GET /api/v1/portfolio/trades
  Returns list of fills with symbol, side, quantity, price
  Each fill shows slippage percentage and execution latency
  Sorted by filled_at desc
result: pending

### 7. Reset Portfolio
expected: |
  POST /api/v1/portfolio/reset {"confirm": true}
  Archives current state
  Liquidates all positions at current price
  Resets cash to 100,000 INR
  Returns new cash balance
result: pending

### 8. Simulated Execution (Slippage)
expected: |
  Market order fills include slippage 0.01-0.1%
  Buy price is higher than current (worse for buyer)
  Sell price is lower than current (worse for seller)
  Slippage recorded in TradeFill record
result: pending

### 9. Simulated Execution (Latency)
expected: |
  Order fills include execution_latency_ms 50-500ms
  Latency recorded in TradeFill record
  Background order monitor checks every 5 seconds
result: pending

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

[none yet]
