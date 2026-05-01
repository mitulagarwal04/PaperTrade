import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Position } from "./usePortfolio";
import { REFETCH_INTERVAL } from "@/lib/constants";

export function usePositions() {
  return useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: () => api.get("/api/v1/portfolio/positions"),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 5_000,
  });
}
