/** Volume analysis utilities. */

import type { CandleData } from '../types/chart';

export interface VolumeProfileResult {
  totalVolume: number;
  averageVolume: number;
  values: { time: number; volume: number }[];
}

/** Calculates volume profile from candle data. */
export function calcVolumeProfile(data: CandleData[]): VolumeProfileResult {
  const values = data.map((d) => ({
    time: d.time,
    volume: d.volume ?? 0,
  }));

  const totalVolume = values.reduce((acc, v) => acc + v.volume, 0);
  const averageVolume = values.length > 0 ? totalVolume / values.length : 0;

  return { totalVolume, averageVolume, values };
}
