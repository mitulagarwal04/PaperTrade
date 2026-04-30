import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { REFETCH_INTERVAL } from "@/lib/constants";

export interface PortfolioSummary {
  cash_inr: number;
  positions_value_inr: number;
  total_value_inr: number;
  realized_pnl_inr: number;
  unrealized_pnl_inr: number;
  win_rate: number;
  avg_gain_inr: number;
  avg_loss_inr: number;
  max_drawdown_pct: number;
  positions: Position[];
}

export interface Position {
  symbol: string;
  quantity: number;
  avg_cost_inr: number;
  total_cost_inr: number;
  current_price: number;
  current_price_inr: number;
  market_value_inr: number;
  unrealized_pnl_inr: number;
  currency: string;
}

export function usePortfolio() {
  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/v1/portfolio"),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 5_000,
  });
}
