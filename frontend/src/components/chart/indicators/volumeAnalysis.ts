/** Volume profile (pass-through) indicator. */

import type { CandleData } from '@/lib/types/chart';
import type { TimeIndicatorValue } from './movingAverages';

/**
 * Volume profile. Returns volume value for each candle that has volume defined.
 */
export function calcVolumeProfile(data: CandleData[]): TimeIndicatorValue[] {
  return data
    .filter(d => d.volume !== undefined && d.volume !== null)
    .map(d => ({ time: d.time, value: d.volume as number }));
}
