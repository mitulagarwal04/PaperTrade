/** MACD (Moving Average Convergence Divergence) calculation. */

import type { CandleData } from '../types/chart';
import { calcEMA } from './movingAverages';

export interface MACDResult {
  macd: { time: number; value: number }[];
  signal: { time: number; value: number }[];
  histogram: { time: number; value: number }[];
}

/**
 * Calculates MACD:
 * - MACD line: 12-period EMA minus 26-period EMA
 * - Signal line: 9-period EMA of MACD line
 * - Histogram: MACD line minus signal line
 */
export function calcMACD(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const fastEMA = calcEMA(data, fastPeriod);
  const slowEMA = calcEMA(data, slowPeriod);

  // Align and compute MACD line
  const offset = slowEMA.values.length - fastEMA.values.length;
  const macdLine: { time: number; value: number }[] = [];
  for (let i = 0; i < fastEMA.values.length; i++) {
    macdLine.push({
      time: fastEMA.values[i].time,
      value: fastEMA.values[i].value - slowEMA.values[i + offset].value,
    });
  }

  if (macdLine.length < signalPeriod) {
    return { macd: macdLine, signal: [], histogram: [] };
  }

  // Signal line: 9-period EMA of MACD line
  const multiplier = 2 / (signalPeriod + 1);
  const signalLine: { time: number; value: number }[] = [];

  // Seed with SMA of first signalPeriod values
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[i].value;
  }
  let signal = sum / signalPeriod;
  signalLine.push({ time: macdLine[signalPeriod - 1].time, value: signal });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * multiplier + signal;
    signalLine.push({ time: macdLine[i].time, value: signal });
  }

  // Histogram: MACD line minus signal line (aligned)
  const histOffset = macdLine.length - signalLine.length;
  const histogram: { time: number; value: number }[] = signalLine.map((s, i) => ({
    time: s.time,
    value: macdLine[i + histOffset].value - s.value,
  }));

  return { macd: macdLine, signal: signalLine, histogram };
}
