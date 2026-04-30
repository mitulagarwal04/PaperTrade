import { usePriceStore } from "@/stores/priceStore";
import { isPriceStale } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StalePriceBadgeProps {
  symbol: string;
  className?: string;
}

export function StalePriceBadge({ symbol, className }: StalePriceBadgeProps) {
  const priceData = usePriceStore((state) => state.prices[symbol]);

  if (!priceData) {
    return <span className={cn("text-muted text-sm", className)}>---</span>;
  }

  const staleness = isPriceStale(priceData.last_updated);
  const ageInSeconds = Math.floor((Date.now() - priceData.last_updated) / 1000);
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: priceData.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceData.price);

  const isStale = staleness === "stale";
  const isExtended = staleness === "extended";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 group relative",
        className
      )}
    >
      <span
        className={cn(
          "text-sm font-mono tabular-nums transition-opacity duration-150",
          (isStale || isExtended) && "opacity-50",
        )}
        title={`Last updated: ${ageInSeconds}s ago`}
      >
        {formattedPrice}
      </span>
      {isExtended && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-warning-dim text-warning">
          stale
        </span>
      )}
      {/* Tooltip on hover */}
      {(isStale || isExtended) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block px-2 py-1 rounded text-xs bg-surface-2 text-primary border border-border whitespace-nowrap z-50 motion-reduce:transition-none">
          Last updated: {ageInSeconds}s ago
        </div>
      )}
    </span>
  );
}
