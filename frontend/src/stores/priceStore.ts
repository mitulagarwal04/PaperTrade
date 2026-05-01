import { create } from "zustand";

export interface PriceData {
  price: number;
  currency: string;
  source: string;
  is_stale?: boolean;
  last_updated: number;
}

export type WsStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface PriceStore {
  prices: Record<string, PriceData>;
  wsStatus: WsStatus;
  reconnectAttempt: number;
  updatePrices: (data: Record<string, Omit<PriceData, "last_updated">>) => void;
  setWsStatus: (status: WsStatus) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
}

export const usePriceStore = create<PriceStore>()((set) => ({
  prices: {},
  wsStatus: "disconnected",
  reconnectAttempt: 0,
  updatePrices: (data) =>
    set((state) => {
      const now = Date.now();
      const updated: Record<string, PriceData> = {};
      for (const [symbol, price] of Object.entries(data)) {
        updated[symbol] = {
          ...price,
          last_updated: now,
        };
      }
      return { prices: { ...state.prices, ...updated } };
    }),
  setWsStatus: (status) => set({ wsStatus: status }),
  incrementReconnect: () =>
    set((state) => ({ reconnectAttempt: state.reconnectAttempt + 1 })),
  resetReconnect: () => set({ reconnectAttempt: 0 }),
}));
