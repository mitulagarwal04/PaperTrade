/** SMA and EMA moving average calculations. */

import type { CandleData } from '../types/chart';

export interface SMAResult {
  period: number;
  values: { time: number; value: number }[];
}

export interface EMAResult {
  period: number;
  values: { time: number; value: number }[];
}

/** Simple Moving Average — mean of last `period` closing prices. */
export function calcSMA(data: CandleData[], period: number): SMAResult {
  const values: { time: number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    values.push({ time: data[i].time, value: sum / period });
  }
  return { period, values };
}

/** Exponential Moving Average — weighted with multiplier 2/(period+1). */
export function calcEMA(data: CandleData[], period: number): EMAResult {
  const multiplier = 2 / (period + 1);
  const values: { time: number; value: number }[] = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  values.push({ time: data[period - 1].time, value: ema });

  // Remaining values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    values.push({ time: data[i].time, value: ema });
  }

  return { period, values };
}
