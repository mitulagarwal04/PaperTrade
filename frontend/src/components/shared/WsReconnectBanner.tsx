import { usePriceStore } from "@/stores/priceStore";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function WsReconnectBanner() {
  const wsStatus = usePriceStore((state) => state.wsStatus);
  const reconnectAttempt = usePriceStore((state) => state.reconnectAttempt);

  const isVisible = wsStatus === "reconnecting" || wsStatus === "disconnected";

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-1.5 bg-warning-dim/50 border-b border-warning/30 text-warning text-sm transition-all duration-300 ease-out motion-reduce:transition-none",
        isVisible ? "max-h-12 opacity-100" : "max-h-0 opacity-0 overflow-hidden py-0"
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        Reconnecting to price feed{reconnectAttempt > 0 ? ` (attempt ${reconnectAttempt})` : ""}...
      </span>
    </div>
  );
}
