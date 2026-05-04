"""Chart data endpoints."""
import asyncio
import time
from typing import Any

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.cache.manager import CacheManager

router = APIRouter()

INTERVAL_MAP: dict[str, dict[str, str]] = {
    "1d": {"period": "1d", "interval": "5m"},
    "5d": {"period": "5d", "interval": "15m"},
    "1mo": {"period": "1mo", "interval": "1h"},
    "3mo": {"period": "3mo", "interval": "1d"},
    "6mo": {"period": "6mo", "interval": "1d"},
    "1y": {"period": "1y", "interval": "1d"},
    "5y": {"period": "5y", "interval": "1wk"},
}

VALID_RANGES = r"^(1d|5d|1mo|3mo|6mo|1y|5y)$"
VALID_INTERVALS = r"^(1m|5m|15m|30m|1h|1d|1wk)$"

# In-memory cache for chart data
_chart_cache: dict[str, dict[str, Any]] = {}


def _get_cache_ttl(interval: str) -> int:
    """Get cache TTL based on interval resolution."""
    if interval in ("5m", "15m", "30m"):
        return 60
    elif interval == "1h":
        return 300
    return 600


@router.get("/charts/{symbol}")
async def get_chart_data(
    symbol: str,
    range: str = Query("1mo", alias="range", pattern=VALID_RANGES),
    interval: str = Query(None, alias="interval", pattern=VALID_INTERVALS),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Get historical OHLC chart data for an asset.

    Uses yfinance via an executor thread to avoid blocking the event loop.
    Results are cached in-memory with per-resolution TTL:
      - 60s  for intraday resolutions (5m, 15m, 30m)
      - 300s for hourly (1h)
      - 600s for daily+ (1d, 1wk)
    """
    symbol = symbol.upper()

    if interval is None:
        interval = INTERVAL_MAP[range]["interval"]

    period = INTERVAL_MAP[range]["period"]
    cache_key = f"chart:{symbol}:{range}:{interval}"
    cache_ttl = _get_cache_ttl(interval)

    # Check in-memory cache
    now = time.time()
    cached = _chart_cache.get(cache_key)
    if cached and (now - cached["timestamp"]) < cache_ttl:
        return cached["data"]

    try:
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(
            None,
            lambda: yf.download(
                symbol,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=True,
            ),
        )

        if df.empty:
            raise HTTPException(
                status_code=503,
                detail=f"No historical data for {symbol}",
            )

        data = []
        for idx, row in df.iterrows():
            data.append({
                "time": int(idx.timestamp()),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]),
            })

        result = {
            "symbol": symbol,
            "interval": interval,
            "data": data,
        }

        _chart_cache[cache_key] = {"timestamp": now, "data": result}
        return result
    except HTTPException:
        raise
    except Exception:
        if cached:
            return cached["data"]
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch chart data for {symbol}",
        )
