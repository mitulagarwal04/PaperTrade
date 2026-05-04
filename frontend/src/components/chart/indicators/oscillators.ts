/** RSI indicator calculation using Wilder's smoothing. */

import type { CandleData } from '@/lib/types/chart';
import type { TimeIndicatorValue } from './movingAverages';

/**
 * Relative Strength Index over `period` candles (default 14).
 * Returns values between 0-100, with first `period` results omitted.
 * Uses Wilder's smoothing for average gain/loss.
 */
export function calcRSI(data: CandleData[], period: number = 14): TimeIndicatorValue[] {
  const result: TimeIndicatorValue[] = [];
  if (data.length < period + 1) return result;

  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // First average gain/loss over initial `period` changes
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value (at index `period` in changes = index `period+1` in data)
  let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push({ time: data[period].time, value: rsi });

  // Subsequent values with Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[i + 1].time, value: rsi });
  }

  return result;
}
