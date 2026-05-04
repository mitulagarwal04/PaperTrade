/** SMA and EMA indicator calculations. */

import type { CandleData } from '@/lib/types/chart';

export interface TimeIndicatorValue {
  time: number;
  value: number;
}

/**
 * Simple Moving Average over `period` candles.
 * Returns array aligned by time, with leading (period-1) values omitted.
 */
export function calcSMA(data: CandleData[], period: number = 20): TimeIndicatorValue[] {
  const result: TimeIndicatorValue[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - (period - 1); j <= i; j++) {
      sum += data[j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

/**
 * Exponential Moving Average over `period` candles using Wilder's smoothing.
 * First value = SMA of first `period` values.
 * Subsequent: ema = close * multiplier + prev_ema * (1 - multiplier).
 */
export function calcEMA(data: CandleData[], period: number = 20): TimeIndicatorValue[] {
  const result: TimeIndicatorValue[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  // First EMA value = SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  result.push({ time: data[period - 1].time, value: prevEma });

  // Subsequent values
  for (let i = period; i < data.length; i++) {
    const ema = data[i].close * multiplier + prevEma * (1 - multiplier);
    result.push({ time: data[i].time, value: ema });
    prevEma = ema;
  }

  return result;
}
