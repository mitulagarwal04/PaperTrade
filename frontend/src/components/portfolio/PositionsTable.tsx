import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePositions } from "@/hooks/usePositions";
import { usePriceStore } from "@/stores/priceStore";
import { isPriceStale } from "@/lib/constants";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";

type SortField = "symbol" | "quantity" | "avg_cost_inr" | "current_price" | "market_value_inr" | "unrealized_pnl_inr";
type SortDir = "asc" | "desc";

export function PositionsTable() {
  const navigate = useNavigate();
  const { data: positions, isPending, isError, error, refetch } = usePositions();
  const livePrices = usePriceStore((state) => state.prices);
  const [sortField, setSortField] = useState<SortField>("market_value_inr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Enrich positions with live WS prices for staleness detection only
  const enrichedPositions = useMemo(() => {
    if (!positions) return [];
    return positions.map((pos) => {
      const live = livePrices[pos.symbol];
      const staleness = live ? isPriceStale(live.last_updated) : "fresh";
      return {
        ...pos,
        displayPrice: pos.current_price_inr,
        displayMarketValue: pos.market_value_inr,
        displayPnl: pos.unrealized_pnl_inr,
        pnlPercent: pos.total_cost_inr > 0
          ? (pos.unrealized_pnl_inr / Number(pos.total_cost_inr)) * 100
          : 0,
        isStale: staleness !== "fresh",
      };
    });
  }, [positions, livePrices]);

  // Sort
  const sortedPositions = useMemo(() => {
    return [...enrichedPositions].sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] ?? 0;
      const bVal = b[sortField as keyof typeof b] ?? 0;
      const cmp = typeof aVal === "string"
        ? (aVal as string).localeCompare(bVal as string)
        : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [enrichedPositions, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-xs font-semibold text-muted px-3 py-2 text-left cursor-pointer hover:text-primary transition-colors duration-150 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          <span className="text-info">{sortDir === "asc" ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  if (isPending) return <TableSkeleton rows={5} columns={6} />;
  if (isError) {
    return (
      <ErrorBanner
        message={error?.message || "Could not load positions"}
        onRetry={() => refetch()}
      />
    );
  }
  if (!positions || positions.length === 0) {
    return (
      <EmptyState
        heading="No positions yet"
        body="Start trading to see your portfolio here. Your 100,000 INR starting capital is ready."
        action={{ label: "Place your first trade", onClick: () => navigate("/orders") }}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-subtle">
            <SortHeader field="symbol" label="Symbol" />
            <SortHeader field="quantity" label="Qty" />
            <SortHeader field="avg_cost_inr" label="Avg Cost" />
            <SortHeader field="current_price" label="Current Price" />
            <SortHeader field="market_value_inr" label="Market Value" />
            <SortHeader field="unrealized_pnl_inr" label="P&L" />
            <th className="text-xs font-semibold text-muted px-3 py-2 text-left">P&L%</th>
          </tr>
        </thead>
        <tbody>
          {sortedPositions.map((pos) => {
            const isPnlPositive = pos.displayPnl >= 0;
            return (
              <tr
                key={pos.symbol}
                className="border-b border-border-subtle hover:bg-surface-1 transition-colors duration-150"
              >
                <td className="px-3 py-2 text-sm font-medium">{pos.symbol}</td>
                <td className="px-3 py-2 text-sm tabular-nums">{Number(pos.quantity).toFixed(4)}</td>
                <td className="px-3 py-2 text-sm tabular-nums">₹{Number(pos.avg_cost_inr).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td className={cn("px-3 py-2 text-sm tabular-nums", pos.isStale && "opacity-50")}>
                  ₹{Number(pos.displayPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-sm tabular-nums">₹{pos.displayMarketValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td className={cn("px-3 py-2 text-sm tabular-nums font-medium", isPnlPositive ? "text-positive" : "text-negative")}>
                  <div className="flex items-center gap-1">
                    {isPnlPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    ₹{Math.abs(pos.displayPnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </td>
                <td className={cn("px-3 py-2 text-sm tabular-nums", isPnlPositive ? "text-positive" : "text-negative")}>
                  {isPnlPositive ? "+" : ""}{pos.pnlPercent.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
