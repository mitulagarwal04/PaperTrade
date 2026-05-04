# Phase 3: Charts & Technical Analysis - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 21 (10 new, 5 modify, 6 utility/composable)
**Analogs found:** 16 / 21

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/routes/charts.py` | controller (route) | CRUD | `prices.py` | exact |
| `frontend/src/pages/ChartPage.tsx` | page | request-response | `AssetsPage.tsx` | exact |
| `frontend/src/components/chart/ChartContainer.tsx` | component | event-driven | No existing chart component | new-pattern |
| `frontend/src/components/chart/ChartToolbar.tsx` | component | event-driven | `WsReconnectBanner.tsx` | component-match |
| `frontend/src/components/chart/indicators/*.ts` | utility | transform | `constants.ts` staleness check | utility-match |
| `frontend/src/components/chart/drawingTools/DrawingCanvas.tsx` | component | event-driven | No canvas component | new-pattern |
| `frontend/src/components/chart/drawingTools/drawingState.ts` | utility | CRUD (localStorage) | No localStorage util | new-pattern |
| `frontend/src/hooks/useChartData.ts` | hook | request-response | `useAssets.ts` | exact |
| `frontend/src/hooks/useCandleAggregator.ts` | hook | event-driven | `useWebSocket.ts` | role-match |
| `frontend/src/hooks/useTimeframe.ts` | hook | state | `priceStore.ts` (Zustand) | role-match |
| `frontend/src/lib/candleUtils.ts` | utility | transform | `constants.ts` | utility-match |
| `frontend/src/lib/indicatorUtils.ts` | utility | barrel-export | `api.ts` | utility-match |
| `frontend/src/main.tsx` | config | route-registration | itself (add child route) | exact |
| `frontend/src/components/assets/AssetPriceRow.tsx` | component | event-driven | itself (add onClick) | exact |
| `backend/app/main.py` | config | route-registration | itself (add include_router) | exact |
| `frontend/src/lib/constants.ts` | config | constants | itself (add chart consts) | exact |

## Pattern Assignments

### `backend/app/api/routes/charts.py` (controller, CRUD)

**Analog:** `backend/app/api/routes/prices.py`

**Imports pattern** (lines 1-11):
```python
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry
from app.providers.schemas import AssetPrice
from app.config import get_settings
```

**Core GET endpoint pattern** (prices.py lines 41-53):
```python
@router.get("/prices/{symbol}", response_model=dict)
async def get_price(symbol: str, session: AsyncSession = Depends(get_db)):
    """Get current price for an asset."""
    service = PriceService(session)
    price = await service.get_price(symbol.upper())
    return {
        "symbol": price.symbol,
        "price": price.price,
        ...
    }
```

**Error handling with HTTPException** (prices.py lines 35-38):
```python
except Exception:
    if cached:
        return cached
    raise HTTPException(status_code=503, detail=f"No price available for {symbol}")
```

**yfinance blocking call pattern** (YFinanceProvider `fetch_price` lines 23-30):
```python
async def fetch_price(self, symbol: str) -> AssetPrice:
    try:
        return await asyncio.get_event_loop().run_in_executor(
            None, self._fetch_sync, symbol
        )
    except Exception as e:
        raise ProviderError(f"yfinance fetch failed for {symbol}: {e}")
```

**CacheManager usage pattern** (prices.py lines 23-38):
```python
service = PriceService(session)
cached = await self.cache.get(symbol, ttl_seconds=settings.cache_ttl_seconds)
if cached and not cached.is_stale:
    return cached
```

**Key differences for charts.py:** NEW creates `/charts/{symbol}` with query params `range` and `interval`, uses `asyncio.run_in_executor` for yfinance `ticker.history()`, returns OHLC array. The prices.py `PriceService` pattern adapts well.

---

### `frontend/src/pages/ChartPage.tsx` (page, request-response)

**Analog:** `frontend/src/pages/AssetsPage.tsx`

**Page pattern** (AssetsPage.tsx lines 1-37):
```typescript
import { useAssets } from "@/hooks/useAssets";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";

export default function AssetsPage() {
  const { data: assets, isPending, isError, error, refetch } = useAssets();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Assets</h1>
      <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
        {isPending && <TableSkeleton rows={6} columns={2} />}
        {isError && (
          <ErrorBanner message={error?.message || "..."} onRetry={() => refetch()} />
        )}
        {data && data.length === 0 && (
          <div className="text-center py-16">...</div>
        )}
        {data && data.map(...)}
      </div>
    </div>
  );
}
```

**Key differences for ChartPage:** Uses `useParams` to get `symbol` from route, uses `useChartData` hook (analogous to `useAssets`), uses `ChartContainer` instead of table, adds `ChartToolbar`, subscribes to WS for real-time candle updates via `useCandleAggregator`.

---

### `frontend/src/hooks/useChartData.ts` (hook, request-response)

**Analog:** `frontend/src/hooks/useAssets.ts`

**useQuery pattern** (useAssets.ts lines 1-17):
```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Asset { symbol: string; name: string; type: string; currency: string; }

export function useAssets() {
  return useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => api.get("/api/v1/assets"),
    staleTime: 60_000,
  });
}
```

**Key differences for useChartData:** Query key includes `[symbol, range, interval]`, calls `api.get("/api/v1/charts/" + symbol + ...)`, returns CandleData[] type. staleTime longer (historical data rarely changes).

---

### `frontend/src/lib/api.ts` (utility) + `frontend/src/main.tsx` (route-config) + `frontend/src/lib/constants.ts` (config)

**API client pattern** (api.ts lines 10-28):
```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return res.json();
}
export const api = { get: <T>(path: string) => request<T>(path), ... };
```

**Route registration pattern** (main.tsx lines 28-34):
```typescript
children: [
  { index: true, element: <DashboardPage /> },
  { path: "dashboard", element: <DashboardPage /> },
  ...
  { path: "chart/:symbol", element: <ChartPage /> },  // ADD this
],
```

**Constants pattern** (constants.ts lines 1-6):
```typescript
export const WS_URL = `.../ws/prices`;
export const REFETCH_INTERVAL = 10_000;
```

**Backend router registration pattern** (main.py lines 155-157):
```python
app.include_router(prices_router, prefix="/api/v1")
app.include_router(charts_router, prefix="/api/v1")  # ADD this
```

---

### `frontend/src/hooks/useCandleAggregator.ts` (hook, event-driven)

**Analog:** `frontend/src/hooks/useWebSocket.ts`

**WS + Zustand consumption pattern** (useWebSocket.ts lines 1-65):
```typescript
import { useEffect, useRef } from "react";
import { usePriceStore } from "@/stores/priceStore";
import { WS_URL, MAX_BACKOFF } from "@/lib/constants";

export function useCandleAggregator(symbol: string, interval: string, seriesRef: RefObject<...>) {
  const candleMapRef = useRef<Map<number, Candle>>(new Map());
  const currentPrice = usePriceStore((s) => s.prices[symbol]?.price);

  useEffect(() => {
    if (currentPrice == null) return;
    const now = Math.floor(Date.now() / 1000);
    const aligned = alignTime(now, interval);
    // upsert candle in candleMapRef, then call seriesRef.current.update(candle)
  }, [currentPrice]);
}
```

**Key difference:** Instead of managing connection lifecycle (already handled by global `useWebSocket`/`usePriceStore`), this hook reacts to price changes from the store and aggregates into OHLC candles in a `useRef<Map>`.

---

### `frontend/src/components/assets/AssetPriceRow.tsx` (modify, add click handler)

**Navigate pattern to add** (import + use):
```typescript
import { useNavigate } from "react-router-dom";

export function AssetPriceRow({ symbol, name, type, currency }: AssetPriceRowProps) {
  const navigate = useNavigate();
  // Add onClick to navigate
  // onClick={() => navigate(`/chart/${symbol}`)}
}
```

---

### Cross-cutting: Error states

**ErrorBanner** (ErrorBanner.tsx lines 1-45):
```typescript
interface ErrorBannerProps { message: string; onRetry?: () => void; onDismiss?: () => void; className?: string; }
export function ErrorBanner({ message, onRetry, onDismiss, className }: ErrorBannerProps) {
  // renders inline alert with retry button
}
```

---

## Shared Patterns

### TanStack Query State Handling
**Source:** `frontend/src/pages/AssetsPage.tsx` lines 7-33, `frontend/src/hooks/useAssets.ts` lines 1-17
**Apply to:** ChartPage, useChartData
```
Three states: isPending -> LoadingSkeleton, isError -> ErrorBanner, data.length === 0 -> empty state
useQuery({ queryKey: [...], queryFn: () => api.get(...), staleTime: N })
```

### ErrorBanner + LoadingSkeleton
**Source:** `ErrorBanner.tsx`, `LoadingSkeleton.tsx`
**Apply to:** ChartPage (loading = chart skeleton, error = ErrorBanner inside chart container)

### Zustand Store Pattern
**Source:** `frontend/src/stores/priceStore.ts` lines 1-43
**Apply to:** useTimeframe, drawingState (if using Zustand)
```
create<interface>()((set) => ({ state, action: () => set(...) }))
```

### Backend DB Dependency Injection
**Source:** `backend/app/api/deps.py` lines 1-15
**Apply to:** charts.py
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_session():
        yield session
```

### Cross-Cutting: Security (ASVS L1)
**Source:** CONTEXT.md + RESEARCH.md
**Apply to:** charts.py input validation (FastAPI Query param validation for `range` enum, `symbol` regex)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ChartContainer.tsx` | component | event-driven | First chart component; use RESEARCH.md Pattern 1 |
| `DrawingCanvas.tsx` | component | event-driven | No canvas overlay primitives in codebase |
| `drawingState.ts` | utility | CRUD (localStorage) | No localStorage abstraction exists |
| `candleUtils.ts` | utility | transform | No time-bucketing utilities exist |
| `indicators/*.ts` | utility | transform | No client-side calc utilities exist |

For these, use RESEARCH.md code examples (lines 134-198 ChartContainer, lines 296-365 candle aggregation, lines 449-488 drawing state).

## Metadata

**Analog search scope:** `backend/app/api/routes/`, `backend/app/cache/`, `backend/app/providers/`, `frontend/src/pages/`, `frontend/src/hooks/`, `frontend/src/lib/`, `frontend/src/components/`, `frontend/src/stores/`
**Files scanned:** 18 source files
**Pattern extraction date:** 2026-05-04
