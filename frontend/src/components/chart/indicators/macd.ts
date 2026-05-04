/** MACD indicator calculation. */

import type { CandleData } from '@/lib/types/chart';
import type { TimeIndicatorValue } from './movingAverages';
import { calcEMA } from './movingAverages';

export interface MACDResult {
  macd: TimeIndicatorValue[];
  signal: TimeIndicatorValue[];
  histogram: TimeIndicatorValue[];
}

/**
 * MACD (Moving Average Convergence Divergence).
 * MACD line = EMA(fastPeriod) - EMA(slowPeriod).
 * Signal line = EMA of MACD line over signalPeriod.
 * Histogram = MACD line - Signal line.
 */
export function calcMACD(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const fastEma = calcEMA(data, fastPeriod);
  const slowEma = calcEMA(data, slowPeriod);

  // Build MACD line by diffing aligned EMA values
  const macdLine: TimeIndicatorValue[] = [];
  // Slow EMA starts later (larger period), so align to slow EMA start
  const slowStart = data.length >= slowPeriod ? slowPeriod - 1 : 0;
  const fastStart = data.length >= fastPeriod ? fastPeriod - 1 : 0;

  // Find common aligned range
  const macdStart = Math.max(slowStart, fastStart);
  for (let i = macdStart; i < data.length; i++) {
    const fast = fastEma.find(e => e.time === data[i].time);
    const slow = slowEma.find(e => e.time === data[i].time);
    if (fast && slow) {
      macdLine.push({ time: data[i].time, value: fast.value - slow.value });
    }
  }

  // Signal line = EMA of MACD line over signalPeriod
  const signalLine = calcMACD_EMA(macdLine, signalPeriod);

  // Histogram = MACD line - Signal line (aligned)
  const histogram: TimeIndicatorValue[] = [];
  const signalStartTime = signalLine.length > 0 ? signalLine[0].time : 0;
  for (let i = 0; i < macdLine.length; i++) {
    const signal = signalLine.find(s => s.time === macdLine[i].time);
    if (signal) {
      histogram.push({ time: macdLine[i].time, value: macdLine[i].value - signal.value });
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/** Internal EMA calculator for TimeIndicatorValue arrays (used for MACD signal). */
function calcMACD_EMA(data: TimeIndicatorValue[], period: number): TimeIndicatorValue[] {
  const result: TimeIndicatorValue[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].value;
  let prevEma = sum / period;
  result.push({ time: data[period - 1].time, value: prevEma });

  for (let i = period; i < data.length; i++) {
    const ema = data[i].value * multiplier + prevEma * (1 - multiplier);
    result.push({ time: data[i].time, value: ema });
    prevEma = ema;
  }

  return result;
}
