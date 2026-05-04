/** Candle data utility functions for time alignment and interval mapping. */

import type { ChartRange, ChartInterval } from './types/chart';

/** Maps ChartRange to yfinance period and interval strings. */
export const INTERVAL_MAP: Record<ChartRange, { period: string; interval: ChartInterval }> = {
  '1d': { period: '1d', interval: '5m' },
  '5d': { period: '5d', interval: '15m' },
  '1mo': { period: '1mo', interval: '1h' },
  '3mo': { period: '3mo', interval: '1d' },
  '6mo': { period: '6mo', interval: '1d' },
  '1y': { period: '1y', interval: '1d' },
  '5y': { period: '5y', interval: '1wk' },
};

/**
 * Rounds a Unix timestamp down to the nearest interval boundary.
 * All operations are UTC-based for consistency with backend data.
 */
export function alignTime(ts: number, interval: ChartInterval): number {
  switch (interval) {
    case '5m':
      // Floor to 5-minute boundary
      return Math.floor(ts / 300) * 300;
    case '15m':
      // Floor to 15-minute boundary
      return Math.floor(ts / 900) * 900;
    case '1h':
      // Floor to hour boundary
      return Math.floor(ts / 3600) * 3600;
    case '1d': {
      // Floor to day boundary (00:00:00 UTC)
      const d = new Date(ts * 1000);
      d.setUTCHours(0, 0, 0, 0);
      return Math.floor(d.getTime() / 1000);
    }
    case '1wk': {
      // Floor to week boundary (Monday 00:00:00 UTC)
      const d = new Date(ts * 1000);
      const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      d.setUTCDate(d.getUTCDate() - daysSinceMonday);
      d.setUTCHours(0, 0, 0, 0);
      return Math.floor(d.getTime() / 1000);
    }
  }
}

/** Returns the default interval for a given range. */
export function rangeToInterval(range: ChartRange): ChartInterval {
  return INTERVAL_MAP[range].interval;
}

/** Returns the yfinance period string for a given range. */
export function rangeToPeriod(range: ChartRange): string {
  return INTERVAL_MAP[range].period;
}
