import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChartRange, ChartResponse } from '@/lib/types/chart';
import { rangeToInterval, rangeToPeriod } from '@/lib/candleUtils';

export function useChartData(symbol: string, range: ChartRange) {
  const interval = rangeToInterval(range);
  const period = rangeToPeriod(range);

  return useQuery<ChartResponse>({
    queryKey: ['chart', symbol, range, interval],
    queryFn: () =>
      api.get<ChartResponse>(
        `/api/v1/charts/${symbol}?range=${range}&interval=${interval}`
      ),
    staleTime: 60_000, // 1 min — historical data is mostly static
    retry: 2,
    enabled: !!symbol,
    select: (response) => ({
      ...response,
      data: response.data.map((c) => ({
        ...c,
        time: Number(c.time), // Ensure time is always number
      })),
    }),
  });
}
