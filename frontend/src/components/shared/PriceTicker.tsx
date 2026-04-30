import { cn } from "@/lib/utils";
import { usePriceStore } from "@/stores/priceStore";

interface PriceTickerProps {
  symbol: string;
  className?: string;
}

export function PriceTicker({ symbol, className }: PriceTickerProps) {
  const priceData = usePriceStore((state) => state.prices[symbol]);

  if (!priceData) {
    return <span className={cn("text-muted text-sm", className)}>---</span>;
  }

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: priceData.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceData.price);

  return (
    <span className={cn("text-sm font-mono tabular-nums", className)}>
      {formattedPrice}
    </span>
  );
}
