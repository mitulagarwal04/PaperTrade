import { useNavigate } from "react-router-dom";
import { usePriceStore } from "@/stores/priceStore";
import { isPriceStale } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AssetPriceRowProps {
  symbol: string;
  name: string;
  type: string;
  currency: string;
}

export function AssetPriceRow({ symbol, name, type }: AssetPriceRowProps) {
  const navigate = useNavigate();
  const priceData = usePriceStore((state) => state.prices[symbol]);

  if (!priceData) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border-subtle group relative cursor-pointer hover:bg-surface-2/50 transition-colors duration-150"
        onClick={() => navigate(`/chart/${symbol}`)}
      >
        <div>
          <p className="text-sm font-medium">{symbol}</p>
          <p className="text-xs text-muted">{name} &middot; {type}</p>
        </div>
        <span className="text-sm text-muted">---</span>
      </div>
    );
  }

  const staleness = isPriceStale(priceData.last_updated);
  const ageInSeconds = Math.floor((Date.now() - priceData.last_updated) / 1000);
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: priceData.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceData.price);

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-border-subtle group relative cursor-pointer hover:bg-surface-2/50 transition-colors duration-150"
      onClick={() => navigate(`/chart/${symbol}`)}
    >
      <div>
        <p className={cn("text-sm font-medium", staleness !== "fresh" && "opacity-50")}>
          {symbol}
        </p>
        <p className={cn("text-xs text-muted", staleness !== "fresh" && "opacity-50")}>
          {name} &middot; {type}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-mono tabular-nums", staleness !== "fresh" && "opacity-50")}>
          {formattedPrice}
        </span>
        {staleness === "extended" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-warning-dim text-warning">
            stale
          </span>
        )}
        {staleness !== "fresh" && (
          <div className="absolute right-0 top-full mt-1 hidden group-hover:block px-2 py-1 rounded text-xs bg-surface-2 text-primary border border-border whitespace-nowrap z-50">
            Last updated: {ageInSeconds}s ago
          </div>
        )}
      </div>
    </div>
  );
}
