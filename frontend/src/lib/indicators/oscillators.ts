/** RSI (Relative Strength Index) oscillator calculation. */

import type { CandleData } from '../types/chart';

export interface RSIResult {
  period: number;
  values: { time: number; value: number }[];
}

/**
 * Calculates the Relative Strength Index using Wilder's smoothing method.
 * Formula: RSI = 100 - (100 / (1 + RS))
 * where RS = average gain / average loss over the period.
 */
export function calcRSI(data: CandleData[], period: number = 14): RSIResult {
  const values: { time: number; value: number }[] = [];

  if (data.length < period + 1) {
    return { period, values: [] };
  }

  // Initial SMA of gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) {
      avgGain += diff;
    } else {
      avgLoss -= diff;
    }
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  const firstRs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
  values.push({ time: data[period].time, value: 100 - 100 / (1 + firstRs) });

  // Wilder's smoothing for remaining values
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    values.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }

  return { period, values };
}
