import { describe, it, expect } from 'vitest';
import { calcSMA, calcEMA } from './movingAverages';
import { calcRSI } from './oscillators';
import { calcBollingerBands } from './bollingerBands';
import { calcMACD } from './macd';
import { calcVolumeProfile } from './volumeAnalysis';
import type { CandleData } from '@/lib/types/chart';

function makeCandle(close: number, i: number, volume?: number): CandleData {
  return {
    time: 1609459200 + i * 86400,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume,
  };
}

const data5: CandleData[] = [10, 20, 30, 40, 50].map((c, i) => makeCandle(c, i));

describe('calcSMA', () => {
  it('returns correct rolling average with period 3', () => {
    const result = calcSMA(data5, 3);
    expect(result).toHaveLength(3);
    // First valid at index 2 (period-1): (10+20+30)/3 = 20
    expect(result[0].value).toBeCloseTo(20, 10);
    expect(result[0].time).toBe(data5[2].time);
    // Index 3: (20+30+40)/3 = 30
    expect(result[1].value).toBeCloseTo(30, 10);
    // Index 4: (30+40+50)/3 = 40
    expect(result[2].value).toBeCloseTo(40, 10);
  });

  it('returns empty array when period > data length', () => {
    expect(calcSMA(data5, 10)).toHaveLength(0);
  });

  it('returns TimeIndicatorValue[] with time and value', () => {
    const result = calcSMA(data5, 3);
    result.forEach(r => {
      expect(r).toHaveProperty('time');
      expect(r).toHaveProperty('value');
      expect(typeof r.time).toBe('number');
      expect(typeof r.value).toBe('number');
    });
  });
});

describe('calcEMA', () => {
  it('returns correct EMA values with period 3', () => {
    const result = calcEMA(data5, 3);
    expect(result).toHaveLength(3);
    // First EMA = SMA of first 3: (10+20+30)/3 = 20
    expect(result[0].value).toBeCloseTo(20, 10);
    expect(result[0].time).toBe(data5[2].time);

    // multiplier = 2 / (3+1) = 0.5
    // EMA[3] = 40 * 0.5 + 20 * 0.5 = 20 + 10 = 30
    expect(result[1].value).toBeCloseTo(30, 10);
    // EMA[4] = 50 * 0.5 + 30 * 0.5 = 25 + 15 = 40
    expect(result[2].value).toBeCloseTo(40, 10);
  });

  it('returns empty array when period > data length', () => {
    expect(calcEMA(data5, 10)).toHaveLength(0);
  });
});

describe('calcRSI', () => {
  it('returns values between 0 and 100', () => {
    // Use trending data for clear RSI
    const trendData: CandleData[] = [];
    for (let i = 0; i < 30; i++) {
      trendData.push(makeCandle(100 + i * 2, i));
    }
    const result = calcRSI(trendData, 14);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(r => {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    });
  });

  it('returns values > 70 for strongly uptrending data', () => {
    const trendData: CandleData[] = [];
    for (let i = 0; i < 30; i++) {
      trendData.push(makeCandle(100 + i * 3, i));
    }
    const result = calcRSI(trendData, 14);
    // Last values should be overbought
    const last = result[result.length - 1];
    expect(last.value).toBeGreaterThan(70);
  });

  it('has first valid value at index `period` in data', () => {
    const result = calcRSI(data5, 3);
    // With 5 data points (indices 0-4) and period 3:
    // changes = [10, 10, 10, 10] (4 changes from 5 data points)
    // First avg over changes[0..2] (3 changes), first RSI at data[3].time
    if (result.length > 0) {
      expect(result[0].time).toBe(data5[3].time);
    }
  });
});

describe('calcBollingerBands', () => {
  it('returns upper, middle, lower arrays', () => {
    const result = calcBollingerBands(data5, 3, 2);
    expect(result).toHaveProperty('upper');
    expect(result).toHaveProperty('middle');
    expect(result).toHaveProperty('lower');
    expect(result.upper.length).toBeGreaterThan(0);
    expect(result.middle.length).toBe(result.upper.length);
    expect(result.lower.length).toBe(result.upper.length);
  });

  it('middle band equals SMA', () => {
    const result = calcBollingerBands(data5, 3, 2);
    const sma = calcSMA(data5, 3);
    expect(result.middle.length).toBe(sma.length);
    result.middle.forEach((m, i) => {
      expect(m.value).toBeCloseTo(sma[i].value, 10);
    });
  });

  it('upper band >= middle >= lower', () => {
    const result = calcBollingerBands(data5, 3, 2);
    result.upper.forEach((u, i) => {
      expect(u.value).toBeGreaterThanOrEqual(result.middle[i].value);
      expect(result.middle[i].value).toBeGreaterThanOrEqual(result.lower[i].value);
    });
  });
});

describe('calcMACD', () => {
  it('returns macd, signal, histogram arrays', () => {
    // Need enough data for slow period (26) + signal period (9)
    const longData: CandleData[] = [];
    for (let i = 0; i < 50; i++) {
      longData.push(makeCandle(100 + Math.sin(i * 0.5) * 10, i));
    }
    const result = calcMACD(longData, 12, 26, 9);
    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('histogram');
    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);
  });

  it('histogram = macd - signal for aligned points', () => {
    const longData: CandleData[] = [];
    for (let i = 0; i < 50; i++) {
      longData.push(makeCandle(100 + Math.sin(i * 0.5) * 10, i));
    }
    const result = calcMACD(longData, 12, 26, 9);
    expect(result.histogram.length).toBeGreaterThan(0);
    for (let i = 0; i < result.histogram.length; i++) {
      const macdV = result.macd.find(m => m.time === result.histogram[i].time);
      const sigV = result.signal.find(s => s.time === result.histogram[i].time);
      if (macdV && sigV) {
        expect(result.histogram[i].value).toBeCloseTo(macdV.value - sigV.value, 5);
      }
    }
  });
});

describe('calcVolumeProfile', () => {
  it('returns volume as-is for each candle with volume', () => {
    const volData = [
      makeCandle(100, 0, 1000),
      makeCandle(101, 1, 2000),
      makeCandle(102, 2, 3000),
    ];
    const result = calcVolumeProfile(volData);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(1000);
    expect(result[1].value).toBe(2000);
    expect(result[2].value).toBe(3000);
  });

  it('skips candles without volume', () => {
    const mixedData = [
      makeCandle(100, 0, 1000),
      makeCandle(101, 1),  // no volume
      makeCandle(102, 2, 3000),
    ];
    const result = calcVolumeProfile(mixedData);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no volumes defined', () => {
    const noVolData = [makeCandle(100, 0), makeCandle(101, 1)];
    const result = calcVolumeProfile(noVolData);
    expect(result).toHaveLength(0);
  });
});
