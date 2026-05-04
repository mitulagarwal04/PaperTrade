import { useEffect, useRef } from 'react';
import { ISeriesApi, CandlestickData } from 'lightweight-charts';
import { usePriceStore } from '@/stores/priceStore';
import { ChartInterval } from '@/lib/types/chart';
import { alignTime } from '@/lib/candleUtils';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useCandleAggregator(
  symbol: string,
  interval: ChartInterval,
  seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>
) {
  const candleMapRef = useRef<Map<number, Candle>>(new Map());
  const seriesValidRef = useRef(false);

  // Track when series becomes available
  useEffect(() => {
    if (seriesRef.current) {
      seriesValidRef.current = true;
    } else {
      // Check periodically until series is available
      const check = setInterval(() => {
        if (seriesRef.current) {
          seriesValidRef.current = true;
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }
  }, [seriesRef.current]);

  const currentPrice = usePriceStore((s) => s.prices[symbol]?.price);

  useEffect(() => {
    if (currentPrice == null || !seriesRef.current || !seriesValidRef.current) return;

    const now = Math.floor(Date.now() / 1000);
    const aligned = alignTime(now, interval);
    const map = candleMapRef.current;
    const existing = map.get(aligned);

    if (!existing) {
      // Create new candle
      const newCandle: Candle = {
        time: aligned,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
      };
      map.set(aligned, newCandle);

      try {
        seriesRef.current.update(newCandle as CandlestickData);
      } catch {
        // chart.update() may throw if candle time is before last bar —
        // this is expected on timeframe switch or initial data load
      }
    } else {
      // Update existing candle
      existing.high = Math.max(existing.high, currentPrice);
      existing.low = Math.min(existing.low, currentPrice);
      existing.close = currentPrice;

      try {
        seriesRef.current.update(existing as CandlestickData);
      } catch {
        // Silently handle edge case where time is out of order
      }
    }
  }, [currentPrice, symbol, interval]);

  // Reset candle map when symbol or interval changes
  useEffect(() => {
    candleMapRef.current.clear();
  }, [symbol, interval]);
}
