import { useState, useCallback } from 'react';
import { ChartRange } from '@/lib/types/chart';

const TIMEFRAMES: { label: string; value: ChartRange }[] = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

export function useTimeframe(initialRange: ChartRange = '1mo') {
  const [range, setRange] = useState<ChartRange>(initialRange);

  const setRangeSafe = useCallback((value: string) => {
    // Only accept valid ChartRange values
    if (TIMEFRAMES.some((t) => t.value === value)) {
      setRange(value as ChartRange);
    }
  }, []);

  return {
    range,
    setRange: setRangeSafe,
    timeframeDefs: TIMEFRAMES,
  };
}
