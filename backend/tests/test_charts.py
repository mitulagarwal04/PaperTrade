"""Tests for chart data endpoints."""
import pytest
from unittest.mock import patch

from app.api.routes.charts import INTERVAL_MAP, _get_cache_ttl


class TestIntervalMapping:
    """Verify all 7 INTERVAL_MAP entries return correct period/interval combos."""

    def test_all_entries_present(self):
        assert len(INTERVAL_MAP) == 7

    def test_1d_mapping(self):
        assert INTERVAL_MAP["1d"] == {"period": "1d", "interval": "5m"}

    def test_5d_mapping(self):
        assert INTERVAL_MAP["5d"] == {"period": "5d", "interval": "15m"}

    def test_1mo_mapping(self):
        assert INTERVAL_MAP["1mo"] == {"period": "1mo", "interval": "1h"}

    def test_3mo_mapping(self):
        assert INTERVAL_MAP["3mo"] == {"period": "3mo", "interval": "1d"}

    def test_6mo_mapping(self):
        assert INTERVAL_MAP["6mo"] == {"period": "6mo", "interval": "1d"}

    def test_1y_mapping(self):
        assert INTERVAL_MAP["1y"] == {"period": "1y", "interval": "1d"}

    def test_5y_mapping(self):
        assert INTERVAL_MAP["5y"] == {"period": "5y", "interval": "1wk"}


class TestCacheTTL:
    """Verify TTL values for different resolutions."""

    def test_intraday_ttl(self):
        assert _get_cache_ttl("5m") == 60
        assert _get_cache_ttl("15m") == 60
        assert _get_cache_ttl("30m") == 60

    def test_hourly_ttl(self):
        assert _get_cache_ttl("1h") == 300

    def test_daily_plus_ttl(self):
        assert _get_cache_ttl("1d") == 600
        assert _get_cache_ttl("1wk") == 600


class TestGetChartData:
    """Test the get_chart_data endpoint with mocked yfinance."""

    @patch("app.api.routes.charts.yf.download")
    async def test_get_chart_data_success(self, mock_download, session):
        """Verify OHLC data is returned with correct shape for a valid symbol."""
        import pandas as pd

        dates = pd.date_range("2024-01-01", periods=5, freq="D")
        mock_df = pd.DataFrame({
            "Open": [100.0, 101.0, 102.0, 103.0, 104.0],
            "High": [105.0, 106.0, 107.0, 108.0, 109.0],
            "Low": [99.0, 100.0, 101.0, 102.0, 103.0],
            "Close": [104.0, 105.0, 106.0, 107.0, 108.0],
            "Volume": [1000, 1100, 1200, 1300, 1400],
        }, index=dates)
        mock_download.return_value = mock_df

        from app.api.routes.charts import get_chart_data, _chart_cache
        _chart_cache.clear()

        result = await get_chart_data(
            "AAPL", range="1mo", interval="1d", session=session,
        )

        assert result["symbol"] == "AAPL"
        assert result["interval"] == "1d"
        assert len(result["data"]) == 5

        first = result["data"][0]
        assert first["open"] == 100.0
        assert first["high"] == 105.0
        assert first["low"] == 99.0
        assert first["close"] == 104.0
        assert first["volume"] == 1000
        assert isinstance(first["time"], int)

        last = result["data"][4]
        assert last["close"] == 108.0

    @patch("app.api.routes.charts.yf.download")
    async def test_get_chart_data_empty(self, mock_download, session):
        """Verify 503 when yfinance returns empty DataFrame."""
        import pandas as pd

        mock_download.return_value = pd.DataFrame()

        from app.api.routes.charts import get_chart_data, _chart_cache
        _chart_cache.clear()

        with pytest.raises(Exception) as exc:
            await get_chart_data(
                "INVALID", range="1mo", interval="1d", session=session,
            )

        assert exc.value.status_code == 503
        assert "No historical data" in str(exc.value.detail)

    @patch("app.api.routes.charts.yf.download")
    async def test_get_chart_data_from_cache(self, mock_download, session):
        """Verify cached data is returned without calling yfinance again."""
        import pandas as pd

        dates = pd.date_range("2024-01-01", periods=3, freq="D")
        mock_df = pd.DataFrame({
            "Open": [100.0, 101.0, 102.0],
            "High": [105.0, 106.0, 107.0],
            "Low": [99.0, 100.0, 101.0],
            "Close": [104.0, 105.0, 106.0],
            "Volume": [1000, 1100, 1200],
        }, index=dates)
        mock_download.return_value = mock_df

        from app.api.routes.charts import get_chart_data, _chart_cache
        _chart_cache.clear()

        # First call populates cache
        result1 = await get_chart_data(
            "AAPL", range="1mo", interval="1d", session=session,
        )
        assert len(result1["data"]) == 3
        assert mock_download.call_count == 1

        # Second call should use cache (no additional yfinance call)
        result2 = await get_chart_data(
            "AAPL", range="1mo", interval="1d", session=session,
        )
        assert len(result2["data"]) == 3
        assert mock_download.call_count == 1

    @patch("app.api.routes.charts.yf.download")
    async def test_yfinance_error_returns_stale_cache(
        self, mock_download, session,
    ):
        """Verify stale cached data is returned when yfinance fails."""
        import pandas as pd

        dates = pd.date_range("2024-01-01", periods=3, freq="D")
        mock_df = pd.DataFrame({
            "Open": [100.0, 101.0, 102.0],
            "High": [105.0, 106.0, 107.0],
            "Low": [99.0, 100.0, 101.0],
            "Close": [104.0, 105.0, 106.0],
            "Volume": [1000, 1100, 1200],
        }, index=dates)

        from app.api.routes.charts import get_chart_data, _chart_cache
        _chart_cache.clear()

        # First call populates cache
        mock_download.return_value = mock_df
        await get_chart_data(
            "AAPL", range="1mo", interval="1d", session=session,
        )

        # Second call: yfinance fails
        mock_download.side_effect = Exception("Network error")
        result = await get_chart_data(
            "AAPL", range="1mo", interval="1d", session=session,
        )

        assert len(result["data"]) == 3  # Stale cache returned


def test_invalid_range_returns_422():
    """Verify invalid range query param returns 422 validation error."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.charts import router as charts_router

    app = FastAPI()
    app.include_router(charts_router, prefix="/api/v1")
    client = TestClient(app)

    response = client.get("/api/v1/charts/AAPL?range=invalid")
    assert response.status_code == 422

    detail = response.json()
    assert any(
        "range" in str(err.get("loc", []))
        for err in detail.get("detail", [])
    )


def test_invalid_interval_returns_422():
    """Verify invalid interval query param returns 422 validation error."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.charts import router as charts_router

    app = FastAPI()
    app.include_router(charts_router, prefix="/api/v1")
    client = TestClient(app)

    response = client.get("/api/v1/charts/AAPL?range=1mo&interval=invalid")
    assert response.status_code == 422
