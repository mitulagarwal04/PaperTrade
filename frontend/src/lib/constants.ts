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
