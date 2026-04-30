import { usePortfolio } from "@/hooks/usePortfolio";
import { SummaryCardsSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { cn } from "@/lib/utils";

export function SummaryCards() {
  const { data, isPending, isError, error, refetch } = usePortfolio();

  if (isPending) return <SummaryCardsSkeleton />;
  if (isError) {
    return (
      <ErrorBanner
        message={error?.message || "Could not load portfolio data"}
        onRetry={() => refetch()}
      />
    );
  }

  const cards = [
    {
      label: "Cash Balance",
      value: data.cash_inr,
      format: "currency",
      testId: "cash-balance",
    },
    {
      label: "Total Value",
      value: data.total_value_inr,
      format: "currency",
      testId: "total-value",
    },
    {
      label: "Unrealized P&L",
      value: data.unrealized_pnl_inr,
      format: "pnl",
      testId: "unrealized-pnl",
    },
    {
      label: "Win Rate",
      value: data.win_rate,
      format: "percent",
      testId: "win-rate",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const isPositive = card.value >= 0;
        const isPnl = card.format === "pnl";

        let displayValue: string;
        if (card.format === "percent") {
          displayValue = `${(Number(card.value) * 100).toFixed(1)}%`;
        } else if (card.format === "pnl") {
          displayValue = `${isPositive ? "+" : ""}₹${Number(card.value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
          displayValue = `₹${Number(card.value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        return (
          <div
            key={card.testId}
            className="bg-surface-1 border border-border rounded-lg p-4"
            data-testid={card.testId}
          >
            <p className="text-xs font-semibold text-muted mb-1">{card.label}</p>
            <p
              className={cn(
                "text-3xl font-semibold tabular-nums",
                isPnl && (isPositive ? "text-positive" : "text-negative")
              )}
            >
              {displayValue}
            </p>
          </div>
        );
      })}
    </div>
  );
}
