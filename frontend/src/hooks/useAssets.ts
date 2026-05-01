import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Asset {
  symbol: string;
  name: string;
  type: string;
  currency: string;
}

export function useAssets() {
  return useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => api.get("/api/v1/assets"),
    staleTime: 60_000,
  });
}
