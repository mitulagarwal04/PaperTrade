/** Bollinger Bands calculation. */

import type { CandleData } from '../types/chart';

export interface BollingerResult {
  period: number;
  stdDev: number;
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
}

/**
 * Calculates Bollinger Bands:
 * - Middle: SMA of closing prices over the period
 * - Upper: Middle + (stdDev * standard deviation)
 * - Lower: Middle - (stdDev * standard deviation)
 */
export function calcBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDev: number = 2,
): BollingerResult {
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const mean = sum / period;

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += (data[j].close - mean) ** 2;
    }
    const std = Math.sqrt(varianceSum / period);

    const time = data[i].time;
    middle.push({ time, value: mean });
    upper.push({ time, value: mean + stdDev * std });
    lower.push({ time, value: mean - stdDev * std });
  }

  return { period, stdDev, upper, middle, lower };
}
