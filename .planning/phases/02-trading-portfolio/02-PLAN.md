---
phase: 2
slug: trading-portfolio
depends_on: []
files_modified:
  - backend/app/models/order.py
  - backend/app/models/portfolio.py
  - backend/app/services/order_service.py
  - backend/app/services/portfolio_service.py
  - backend/app/services/execution_service.py
  - backend/app/api/routes/orders.py
  - backend/app/api/routes/portfolio.py
  - backend/app/tasks/order_monitor.py
  - backend/tests/test_orders.py
  - backend/tests/test_portfolio.py
autonomous: true
---

# Phase 2: Trading & Portfolio

## Objective
Implement order placement, management, and portfolio tracking with FIFO lot accounting, simulated execution with slippage, and full trade audit history.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  POST /orders          GET /orders          DELETE /orders/{id} │
│  GET /portfolio        GET /trades          POST /portfolio/reset│
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  OrderService    PortfolioService    ExecutionService         │
│  - place_order   - get_positions     - fill_order              │
│  - cancel_order  - get_pnl           - simulate_slippage       │
│  - list_orders   - archive_snapshot  - trigger_stop_orders     │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Data Models (SQLAlchemy)                    │
│  Order (state machine)      PortfolioLot (FIFO tracking)       │
│  TradeFill (execution)      PortfolioSnapshot (archive)        │
│  UserCash (100K INR base)                                      │
└─────────────────────────────────────────────────────────────────┘
```

## must_haves

1. **TRADE-01:** Users can place market, limit, stop-loss, and take-profit orders
2. **TRADE-02:** Users can view and cancel open orders
3. **TRADE-03:** Orders execute with simulated latency (50-500ms) and slippage (0.01-0.1%)
4. **TRADE-04:** Partial fills supported with fill records per execution
5. **PORT-01:** Portfolio summary shows positions, cash balance, and net worth in INR
6. **PORT-02:** Trade history includes fills, order IDs, timestamps, and slippage
7. **PORT-03:** P&L metrics: realized/unrealized, win rate, avg gain/loss, max drawdown
8. **PORT-04:** Portfolio reset archives current state and restarts at 100K INR

## Wave Structure

- **Wave 1:** Core Data Models (Order, TradeFill, PortfolioLot)
- **Wave 2:** Order Placement & Execution Service
- **Wave 3:** Portfolio Service & P&L Calculation
- **Wave 4:** Stop/TP Order Monitoring & API Routes
- **Wave 5:** Trade History, Reset, and Tests

## Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| Race condition in order placement | High | Use DB transactions with row-level locking on cash balance |
| Duplicate fills | High | Fill records have unique (order_id, fill_sequence) constraint |
| Stop order trigger missed | Medium | Background task with last-checked timestamp, catch-up logic |
| P&L calculation inconsistent | Medium | Calculate from fills table only, never derived values |
| Negative balance | High | Check `available_balance >= order_value` before order acceptance |

---

## Task 01: Create Order Data Model

**Wave:** 1
**Depends on:** None

<files_to_read>
- backend/app/database.py
- backend/app/cache/models.py (pattern reference)
- backend/app/providers/schemas.py (Currency validation pattern)
</files_to_read>

<action>
Create `backend/app/models/order.py` with SQLAlchemy declarative models:

1. **OrderStatus Enum:** PENDING, OPEN, PARTIAL_FILLED, FILLED, CANCELLED, REJECTED, EXPIRED
2. **OrderType Enum:** MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
3. **OrderSide Enum:** BUY, SELL
4. **Order model:**
   - id: Mapped[int] = mapped_column(primary_key=True)
   - symbol: Mapped[str] = mapped_column(String(20), index=True)
   - side: Mapped[OrderSide] = mapped_column(Enum(OrderSide))
   - order_type: Mapped[OrderType] = mapped_column(Enum(OrderType))
   - quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8), nullable=False)
   - filled_quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8), default=0)
   - price: Mapped[Optional[Decimal]] = mapped_column(Numeric(19, 8))  # null for market
   - stop_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(19, 8))  # for stop/tp
   - status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING, index=True)
   - currency: Mapped[str] = mapped_column(String(3), default="USD")  # original currency
   - reserved_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)  # cash reserved
   - created_at, updated_at: Mapped[datetime]
   - filled_at: Mapped[Optional[datetime]]
   - cancelled_at: Mapped[Optional[datetime]]
   - cancel_reason: Mapped[Optional[str]]
5. **TradeFill model:**
   - id: Mapped[int] = mapped_column(primary_key=True)
   - order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
   - symbol: Mapped[str] = mapped_column(String(20), index=True)
   - quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8))
   - price: Mapped[Decimal] = mapped_column(Numeric(19, 8))
   - currency: Mapped[str] = mapped_column(String(3))
   - slippage_pct: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)
   - execution_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
   - filled_at: Mapped[datetime]
6. Add unique constraint: (order_id, fill_sequence) on TradeFill
7. Indexes: orders.status, orders.symbol, trade_fills.order_id, trade_fills.filled_at
</action>

<acceptance_criteria>
- `backend/app/models/order.py` exists and contains Order, TradeFill classes
- SQLAlchemy mapped_column declarations use correct types (Numeric for decimals)
- Enums defined with Python enum.Enum, SQLAlchemy Enum wrapper
- File imports without errors: `python -c "from app.models.order import Order, TradeFill"`
- Alembic would generate correct migrations (inspect with `alembic revision --autogenerate -m "test" --sql`)
</acceptance_criteria>

---

## Task 02: Create Portfolio Data Model

**Wave:** 1
**Depends on:** None

<files_to_read>
- backend/app/database.py
- backend/app/models/order.py (just created)
</files_to_read>

<action>
Create `backend/app/models/portfolio.py` with SQLAlchemy models:

1. **PortfolioLot model (FIFO tracking):**
   - id: Mapped[int] = mapped_column(primary_key=True)
   - symbol: Mapped[str] = mapped_column(String(20), index=True)
   - quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8))
   - cost_basis: Mapped[Decimal] = mapped_column(Numeric(19, 8))  # per unit in original currency
   - total_cost: Mapped[Decimal] = mapped_column(Numeric(19, 8))
   - currency: Mapped[str] = mapped_column(String(3))  # original currency USD/EUR
   - acquired_at: Mapped[datetime]
   - remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(19, 8))  # for partial sales
   - is_closed: Mapped[bool] = mapped_column(default=False)  # fully sold
   - closed_at: Mapped[Optional[datetime]]
   - realized_pnl: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)  # in INR

2. **UserCash model:**
   - id: Mapped[int] = mapped_column(primary_key=True)
   - total_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=100000)
   - reserved_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)
   - available_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=100000)
   - updated_at: Mapped[datetime] = mapped_column(onupdate=datetime.utcnow)
   - Single row constraint (enforced at app layer)

3. **PortfolioSnapshot model (for reset/archive):**
   - id: Mapped[int] = mapped_column(primary_key=True)
   - snapshot_type: Mapped[str] = mapped_column(String(20))  # "daily" or "reset"
   - captured_at: Mapped[datetime]
   - cash_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2))
   - positions_value_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2))
   - total_value_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2))
   - realized_pnl_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2))
   - unrealized_pnl_inr: Mapped[Decimal] = mapped_column(Numeric(19, 2))
   - positions_json: Mapped[dict] = mapped_column(JSONB)  # serialized positions
   - metrics_json: Mapped[dict] = mapped_column(JSONB)  # win_rate, avg_pnl, etc.
</action>

<acceptance_criteria>
- `backend/app/models/portfolio.py` exists with PortfolioLot, UserCash, PortfolioSnapshot
- PortfolioLot tracks remaining_quantity for FIFO consumption
- UserCash has single-row constraint logic (verify with `CREATE UNIQUE INDEX` on single boolean column)
- snapshot_type enum values: "daily", "reset"
- File imports without errors
</acceptance_criteria>

---

## Task 03: Create Execution Service

**Wave:** 2
**Depends on:** Task 01

<files_to_read>
- backend/app/models/order.py
- backend/app/providers/registry.py (for price fetching)
- backend/app/config.py
</files_to_read>

<action>
Create `backend/app/services/execution_service.py`:

1. **ExecutionService class:**

2. **fill_market_order(order: Order):**
   - Fetch current price via ProviderRegistry
   - Simulate delay: `await asyncio.sleep(random.uniform(0.05, 0.5))`
   - Calculate slippage: `random.uniform(0.0001, 0.001)` for market orders
   - Adjusted price: buy = price * (1 + slippage), sell = price * (1 - slippage)
   - Create TradeFill record with slippage_pct, execution_latency_ms
   - Update order.filled_quantity, order.status = FILLED
   - Return fill record

3. **fill_limit_order(order: Order, current_price: Decimal):**
   - Check if limit condition met (buy: current_price <= limit, sell: current_price >= limit)
   - If not met: return None (no fill)
   - If met: simulate delay + slippage, create TradeFill, update order

4. **check_stop_trigger(order: Order, current_price: Decimal) -> bool:**
   - Stop-loss buy: current_price >= stop_price
   - Stop-loss sell: current_price <= stop_price
   - Take-profit buy: current_price <= stop_price
   - Take-profit sell: current_price >= stop_price
   - Return True if triggered

5. **fill_stop_order(order: Order, triggered_price: Decimal):**
   - Same as market order fill once triggered
   - Record trigger_price separately from fill_price

6. **Helper: _calculate_execution_latency() -> int**
   - Return random int 50-500

7. **Helper: _calculate_slippage(order_type: OrderType) -> Decimal**
   - Market: 0.01-0.1%
   - Limit/Stop: 0.005-0.05% (less slippage)
</action>

<acceptance_criteria>
- `backend/app/services/execution_service.py` exists
- ExecutionService has fill_market_order, fill_limit_order, check_stop_trigger methods
- Slippage calculation adds 0.01-0.1% for buys, subtracts for sells
- Execution latency simulated with asyncio.sleep before price fetch
- All methods async, accept Order model instances
- Unit testable: mocks for ProviderRegistry passed via constructor
</acceptance_criteria>

---

## Task 04: Create Order Service

**Wave:** 2
**Depends on:** Task 01, Task 02, Task 03

<files_to_read>
- backend/app/models/order.py
- backend/app/models/portfolio.py
- backend/app/services/execution_service.py
- backend/app/api/deps.py (get_db pattern)
</files_to_read>

<action>
Create `backend/app/services/order_service.py`:

1. **OrderService class:**

2. **place_order(symbol, side, order_type, quantity, price=None, stop_price=None) -> Order:**
   - Get current price from ProviderRegistry if price=None (market) or for INR conversion
   - Calculate INR value: quantity * price * fx_rate (assume 1 USD = 83 INR for now)
   - **Check available cash:** UserCash.available_inr >= value
   - **Reserve cash:** Update UserCash.reserved_inr += value, recalculate available
   - Create Order with status=PENDING
   - If market order: immediately call ExecutionService.fill_market_order()
   - If limit/stop with immediate fill condition met: fill immediately
   - Otherwise: set status=OPEN
   - Return order

3. **cancel_order(order_id) -> Order:**
   - Fetch order, check status in (OPEN, PARTIAL_FILLED)
   - Release reserved cash: UserCash.reserved_inr -= order.reserved_inr
   - Update order: status=CANCELLED, cancelled_at=now(), cancel_reason="user"
   - Return order

4. **get_order(order_id) -> Order:**
   - Simple fetch with TradeFill relationship

5. **list_orders(status=None, limit=100) -> List[Order]:**
   - Query with optional status filter, ordered by created_at desc

6. **get_open_orders() -> List[Order]:**
   - Filter status in (OPEN, PARTIAL_FILLED)

7. **check_and_fill_pending_orders():**
   - Called periodically for limit/stop order monitoring
   - Fetch OPEN orders with order_type in (LIMIT, STOP_LOSS, TAKE_PROFIT)
   - For each: fetch current price, check if trigger met
   - If met: call ExecutionService.fill_limit_order or fill_stop_order
</action>

<acceptance_criteria>
- `backend/app/services/order_service.py` exists with OrderService class
- place_order validates cash sufficiency before reservation
- place_order uses DB transaction for cash reservation + order creation
- cancel_order releases reserved cash atomically with status update
- list_orders supports status filter, default 100 limit
- All methods accept AsyncSession parameter (explicit, not global)
</acceptance_criteria>

---

## Task 05: Create Portfolio Service

**Wave:** 3
**Depends on:** Task 02, Task 03

<files_to_read>
- backend/app/models/order.py
- backend/app/models/portfolio.py
- backend/app/services/execution_service.py
</files_to_read>

<action>
Create `backend/app/services/portfolio_service.py`:

1. **PortfolioService class:**

2. **process_fill(fill: TradeFill, side: OrderSide):**
   - If BUY: create new PortfolioLot
     - symbol=fill.symbol, quantity=fill.quantity, cost_basis=fill.price
     - total_cost = fill.quantity * fill.price * fx_rate (assume 83 INR/USD)
     - remaining_quantity = fill.quantity, is_closed=False
   - If SELL: consume FIFO lots
     - Fetch open PortfolioLot records for symbol, ordered by acquired_at asc
     - For each lot: sell_qty = min(lot.remaining_quantity, remaining_to_fill)
     - Update lot.remaining_quantity -= sell_qty
     - If lot.remaining_quantity == 0: mark is_closed=True, closed_at=now()
     - Calculate realized_pnl for this portion: (fill_price - lot.cost_basis) * sell_qty * fx_rate - (for sell: reverse sign)
     - Sum across lots, store in lot.realized_pnl
   - Update UserCash: total_inr += (sell_value - buy_value depending on side)
   - Update UserCash: reserved_inr -= order.reserved_inr (release)

3. **get_positions() -> List[Position]:**
   - Query PortfolioLot where is_closed=False
   - Group by symbol, sum quantities and costs
   - Fetch current prices from cache (or ProviderRegistry)
   - Calculate current_value_inr per position
   - Calculate unrealized_pnl per position
   - Return list of Position dataclass with fields: symbol, quantity, avg_cost, current_price, market_value, unrealized_pnl

4. **get_portfolio_summary() -> PortfolioSummary:**
   - cash = UserCash
   - positions = get_positions()
   - positions_value = sum(p.market_value for p in positions)
   - total_value = cash.total_inr + positions_value  # Note: cash already includes realized P&L
   - Calculate realized_pnl from PortfolioLot.realized_pnl sum
   - Calculate unrealized_pnl from positions
   - win_rate = wins / total_closed_trades (from lots)
   - avg_gain, avg_loss calculated from realized_pnl
   - max_drawdown: track peak total_value, drawdown = (peak - current) / peak
   - Return PortfolioSummary dataclass

5. **archive_snapshot(snapshot_type="daily"):**
   - Capture current portfolio via get_portfolio_summary()
   - Serialize to PortfolioSnapshot
   - Store positions_json, metrics_json
</action>

<acceptance_criteria>
- `backend/app/services/portfolio_service.py` exists
- process_fill correctly implements FIFO lot consumption for sells
- get_positions groups lots by symbol and calculates unrealized P&L
- get_portfolio_summary includes cash + positions, realized + unrealized P&L
- archive_snapshot creates PortfolioSnapshot with JSON serialized data
- Position and PortfolioSummary dataclasses defined with proper types
</acceptance_criteria>

---

## Task 06: Create Order Monitor Background Task

**Wave:** 4
**Depends on:** Task 04, Task 05

<files_to_read>
- backend/app/services/order_service.py
- backend/app/websocket/manager.py (reference for async patterns)
</files_to_read>

<action>
Create `backend/app/tasks/order_monitor.py`:

1. **OrderMonitor class:**

2. **__init__(db_session_factory, check_interval=5):**
   - Store async_sessionmaker for DB sessions
   - Store check_interval in seconds

3. **start():**
   - Start asyncio task running _monitor_loop()

4. **stop():**
   - Set stop flag, await task completion

5. **_monitor_loop():**
   - While not stopped:
     - await asyncio.sleep(check_interval)
     - await _check_orders()

6. **_check_orders():**
   - Create async session: async with session_factory() as session:
   - Query Order where status=OPEN and order_type in (LIMIT, STOP_LOSS, TAKE_PROFIT)
   - Also query PARTIAL_FILLED limit orders
   - For each order:
     - Fetch current price via ProviderRegistry.get_price(order.symbol)
     - Call ExecutionService.check_stop_trigger(order, current_price) for stop/tp
     - Call limit fill check: current_price crosses limit price
     - If trigger met: execute fill via ExecutionService
     - Update Portfolio via PortfolioService.process_fill()
     - If order now FILLED: update UserCash to release remaining reserve

7. **Singleton instance:** Create global order_monitor = OrderMonitor()

8. **Lifecycle:**
   - Call order_monitor.start() in app startup (backend/app/main.py)
   - Call order_monitor.stop() in app shutdown
</action>

<acceptance_criteria>
- `backend/app/tasks/order_monitor.py` exists
- OrderMonitor runs _check_orders() every 5 seconds by default
- Only queries ORDER BY created_at for deterministic processing
- Uses session_factory, not global session
- start/stop methods async
- Current price fetched fresh per order check (not cached for trigger accuracy)
</acceptance_criteria>

---

## Task 07: Create Orders API Routes

**Wave:** 4
**Depends on:** Task 04, Task 06

<files_to_read>
- backend/app/api/routes/prices.py (reference FastAPI patterns)
- backend/app/services/order_service.py
- backend/app/models/order.py
</files_to_read>

<action>
Create `backend/app/api/routes/orders.py`:

1. **Pydantic Schemas:**
   - OrderCreateRequest: symbol, side, order_type, quantity, price?, stop_price?
   - OrderResponse: id, symbol, side, order_type, quantity, filled_quantity, price, stop_price, status, created_at, fills[]
   - FillResponse: id, quantity, price, slippage_pct, execution_latency_ms, filled_at
   - CancelOrderRequest: order_id, reason? (optional)

2. **Router:** APIRouter(prefix="/orders", tags=["orders"])

3. **POST /orders:**
   - Request: OrderCreateRequest
   - Service: order_service.place_order()
   - Response: OrderResponse with 201 status

4. **GET /orders:**
   - Query params: status (optional), limit (default 100)
   - Service: order_service.list_orders()
   - Response: List[OrderResponse]

5. **GET /orders/{order_id}:**
   - Service: order_service.get_order()
   - Response: OrderResponse with fills included

6. **DELETE /orders/{order_id}:**
   - Service: order_service.cancel_order()
   - Response: OrderResponse with cancelled status

7. **GET /orders/open:**
   - Service: order_service.get_open_orders()
   - Response: List[OrderResponse]
</action>

<acceptance_criteria>
- `backend/app/api/routes/orders.py` exists with fastapi.APIRouter
- Pydantic request/response models defined with proper validation
- All endpoints async, use get_db dependency
- POST /orders returns 201 Created
- DELETE /orders/{id} accepts only cancellable orders (OPEN, PARTIAL_FILLED)
- Routes registered in backend/app/api/routes/__init__.py
</acceptance_criteria>

---

## Task 08: Create Portfolio API Routes

**Wave:** 4
**Depends on:** Task 05

<files_to_read>
- backend/app/services/portfolio_service.py
- backend/app/api/routes/prices.py
</files_to_read>

<action>
Create `backend/app/api/routes/portfolio.py`:

1. **Pydantic Schemas:**
   - PositionResponse: symbol, quantity, avg_cost_inr, current_price, current_price_inr, market_value_inr, unrealized_pnl_inr
   - PortfolioSummaryResponse: cash_inr, positions_value_inr, total_value_inr, realized_pnl_inr, unrealized_pnl_inr, win_rate, avg_gain_inr, avg_loss_inr, max_drawdown_pct
   - TradeHistoryItem: order_id, symbol, side, quantity, price, filled_at, pnl_inr
   - ResetPortfolioRequest: confirm (bool, must be True)

2. **Router:** APIRouter(prefix="/portfolio", tags=["portfolio"])

3. **GET /portfolio:**
   - Service: portfolio_service.get_portfolio_summary()
   - Include positions list with current values
   - Response: PortfolioSummaryResponse

4. **GET /portfolio/positions:**
   - Service: portfolio_service.get_positions()
   - Response: List[PositionResponse]

5. **GET /portfolio/trades:**
   - Query: start_date?, end_date?, symbol?, limit?
   - Query TradeFill joined with Order, filtered, ordered by filled_at desc
   - Response: List[TradeHistoryItem]

6. **POST /portfolio/reset:**
   - Request: ResetPortfolioRequest (confirm=True required)
   - Actions:
     - Call portfolio_service.archive_snapshot(snapshot_type="reset")
     - Close all open orders: cancel with reason="portfolio_reset"
     - Close all open positions: liquidate at current price, record as "SELL - portfolio reset"
     - Reset UserCash: total_inr=100000, reserved_inr=0, available_inr=100000
     - Mark all PortfolioLot as closed before reset
   - Response: new cash balance

7. **WebSocket broadcast:** After trade execution, broadcast portfolio update via ConnectionManager
</action>

<acceptance_criteria>
- `backend/app/api/routes/portfolio.py` exists with router
- GET /portfolio returns full summary with all P&L metrics
- GET /portfolio/trades supports date filtering via query params
- POST /portfolio/reset requires confirm=true, archives before reset
- All monetary values returned in INR
- WebSocket broadcast integrated after position changes
</acceptance_criteria>

---

## Task 09: Wire Up App and Create Tests

**Wave:** 5
**Depends on:** Task 06, Task 07, Task 08

<files_to_read>
- backend/app/main.py
- backend/tests/conftest.py
</files_to_read>

<action>
Complete integration and create tests:

1. **Update backend/app/main.py:**
   - Import order_monitor from tasks.order_monitor
   - In app startup event: await order_monitor.start()
   - In app shutdown event: await order_monitor.stop()
   - Include orders.router and portfolio.router

2. **Update backend/app/models/__init__.py:**
   - Export Order, TradeFill from order
   - Export PortfolioLot, UserCash, PortfolioSnapshot from portfolio

3. **Update backend/app/api/routes/__init__.py:**
   - Import and include orders.router, portfolio.router

4. **Create backend/tests/test_orders.py:**
   - Test place market order with sufficient cash
   - Test place market order with insufficient cash (rejected)
   - Test cancel open order
   - Test limit order placement and fill
   - Test partial fill handling

5. **Create backend/tests/test_portfolio.py:**
   - Test buy creates PortfolioLot
   - Test sell consumes FIFO lots
   - Test P&L calculation
   - Test portfolio reset archives correctly

6. **Update UserCash on init:**
   - Add to backend/app/main.py startup: create default UserCash if none exists
</action>

<acceptance_criteria>
- backend/app/main.py includes order_monitor.start/stop lifecycle
- Routes registered, accessible at /api/v1/orders and /api/v1/portfolio
- Test files exist with pytest fixtures using async db
- Test coverage: at least place order, cancel order, P&L calc, FIFO sale
- App starts without errors: `python -m uvicorn app.main:app --reload`
</acceptance_criteria>

---

## Verification

Run verification checklist after all tasks complete:

- [ ] Place market BUY order, see cash reserved then deducted
- [ ] Place market SELL order, see FIFO lot consumed, realized P&L updated
- [ ] Place LIMIT order below market, see it stay OPEN until price moves
- [ ] Cancel open LIMIT order, see cash released
- [ ] View portfolio, see positions with unrealized P&L
- [ ] View trade history, see fills with slippage and latency
- [ ] Reset portfolio, archive created, positions cleared, cash back to 100K
- [ ] Stop-loss order triggers when price crossed, executes market fill
- [ ] WebSocket broadcasts portfolio update on trade fill
</planning_document>
