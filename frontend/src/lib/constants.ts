export const STALE_THRESHOLD_MS = 10_000;
export const EXTENDED_STALE_THRESHOLD_MS = 30_000;
export const WS_URL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/prices`;
export const MAX_BACKOFF = 30_000;
export const REFETCH_INTERVAL = 10_000;

export type StalenessLevel = "fresh" | "stale" | "extended";

export function isPriceStale(lastUpdated: number): StalenessLevel {
  const age = Date.now() - lastUpdated;
  if (age < STALE_THRESHOLD_MS) return "fresh";
  if (age < EXTENDED_STALE_THRESHOLD_MS) return "stale";
  return "extended";
}

/** Candle body/wick colors (matching UI-SPEC.md chart extensions). */
export const CHART_CANDLE_COLORS = {
  up: "#22C55E",
  wickUp: "#22C55E",
  down: "#EF4444",
  wickDown: "#EF4444",
} as const;

/** Indicator line colors (matching UI-SPEC.md indicator colors table). */
export const CHART_INDICATOR_COLORS = {
  sma: "#3B82F6",
  ema: "#8B5CF6",
  rsi: "#F59E0B",
  macd: "#6366F1",
  macdSignal: "#F97316",
  macdHistogram: "#A0A5B0",
  bollinger: "#14B8A6",
} as const;

/** Drawing tool colors (matching UI-SPEC.md drawing colors table). */
export const CHART_DRAWING_COLORS = {
  trendline: "#3B82F6",
  horizontal: "#F59E0B",
  vertical: "#6366F1",
  ray: "#14B8A6",
} as const;
