/** Chart-related TypeScript types. */

export type ChartRange = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y';
export type ChartInterval = '5m' | '15m' | '1h' | '1d' | '1wk';
export type ChartType = 'candlestick' | 'line';

export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartResponse {
  symbol: string;
  interval: string;
  data: CandleData[];
}

export interface IndicatorConfig {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'VOL';
  period?: number;
  color?: string;
  enabled: boolean;
}
