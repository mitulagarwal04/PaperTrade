#!/usr/bin/env python3
"""Debug script to test price fetching for GOOGL."""
import asyncio
import yfinance as yf


def test_yfinance_direct():
    """Test yfinance directly."""
    print("Testing GOOGL via yfinance...")
    try:
        ticker = yf.Ticker("GOOGL")
        info = ticker.info
        print(f"Info type: {type(info)}")
        print(f"Info keys: {list(info.keys())[:20] if info else 'None'}")

        if info:
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            print(f"currentPrice: {info.get('currentPrice')}")
            print(f"regularMarketPrice: {info.get('regularMarketPrice')}")
            print(f"previousClose: {info.get('previousClose')}")
            print(f"Final price: {price}")
            print(f"Currency: {info.get('currency')}")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")


def test_aapl():
    """Test AAPL as comparison."""
    print("\nTesting AAPL via yfinance...")
    try:
        ticker = yf.Ticker("AAPL")
        info = ticker.info
        if info:
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            print(f"Price: {price}, Currency: {info.get('currency')}")
        else:
            print("No info returned")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    test_yfinance_direct()
    test_aapl()
