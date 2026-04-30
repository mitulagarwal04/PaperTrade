import { useEffect, useRef } from "react";
import { usePriceStore } from "@/stores/priceStore";
import { WS_URL, MAX_BACKOFF } from "@/lib/constants";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    setWsStatus,
    updatePrices,
    reconnectAttempt,
    incrementReconnect,
    resetReconnect,
  } = usePriceStore();

  const connect = () => {
    setWsStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      resetReconnect();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "prices" && message.data) {
          updatePrices(message.data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setWsStatus("reconnecting");
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  const scheduleReconnect = () => {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_BACKOFF);
    timerRef.current = setTimeout(() => {
      incrementReconnect();
      connect();
    }, delay);
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}
