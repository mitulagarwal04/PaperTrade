import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OrderResponse {
  id: number;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  filled_quantity: number;
  price: number | null;
  stop_price: number | null;
  status: string;
  currency: string;
  reserved_inr: number;
  created_at: string;
  updated_at: string;
  filled_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  fills: FillResponse[];
}

export interface FillResponse {
  id: number;
  quantity: number;
  price: number;
  currency: string;
  slippage_pct: number;
  execution_latency_ms: number;
  filled_at: string;
}

export function useOrders(status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery<OrderResponse[]>({
    queryKey: ["orders", status],
    queryFn: () => api.get(`/api/v1/orders${params}`),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
