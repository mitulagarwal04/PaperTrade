/** Bollinger Bands indicator calculation. */

import type { CandleData } from '@/lib/types/chart';
import type { TimeIndicatorValue } from './movingAverages';

export interface BollingerResult {
  upper: TimeIndicatorValue[];
  middle: TimeIndicatorValue[];
  lower: TimeIndicatorValue[];
}

/**
 * Bollinger Bands over `period` candles with `stdDev` standard deviations.
 * middle = SMA, upper = middle + stdDev * std, lower = middle - stdDev * std.
 */
export function calcBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDev: number = 2,
): BollingerResult {
  const upper: TimeIndicatorValue[] = [];
  const middle: TimeIndicatorValue[] = [];
  const lower: TimeIndicatorValue[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - (period - 1), i + 1);
    const sma = slice.reduce((sum, d) => sum + d.close, 0) / period;

    const variance = slice.reduce((sum, d) => sum + (d.close - sma) ** 2, 0) / period;
    const std = Math.sqrt(variance);

    const time = data[i].time;
    middle.push({ time, value: sma });
    upper.push({ time, value: sma + stdDev * std });
    lower.push({ time, value: sma - stdDev * std });
  }

  return { upper, middle, lower };
}
