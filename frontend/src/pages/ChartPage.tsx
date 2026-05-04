import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { usePriceStore } from '@/stores/priceStore';
import { useChartData } from '@/hooks/useChartData';
import { useTimeframe } from '@/hooks/useTimeframe';
import { useCandleAggregator } from '@/hooks/useCandleAggregator';
import { ChartContainer, ChartContainerAPI } from '@/components/chart/ChartContainer';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { PriceInfoBar } from '@/components/chart/PriceInfoBar';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ErrorBanner } from '@/components/shared/ErrorBanner';
import { rangeToInterval } from '@/lib/candleUtils';
import { cn } from '@/lib/utils';

export default function ChartPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { range, setRange, timeframeDefs } = useTimeframe('1mo');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');

  const { data, isPending, isError, error, refetch } = useChartData(symbol || '', range);
  const prices = usePriceStore((s) => s.prices);
  const priceData = symbol ? prices[symbol] : undefined;

  // Store last candle for price info bar
  const candles = data?.data ?? [];
  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  // WebSocket real-time aggregation
  const interval = rangeToInterval(range);
  useCandleAggregator(symbol || '', interval, seriesRef as React.RefObject<ISeriesApi<'Candlestick'> | null>);

  // Handle chart init — store API refs for aggregator and future indicator/drawing use
  const handleChartInit = (api: ChartContainerAPI) => {
    chartApiRef.current = api.chart;
    if (api.series.seriesType() === 'Candlestick') {
      seriesRef.current = api.series as ISeriesApi<'Candlestick'>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Title bar per UI-SPEC: symbol + price + change */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{symbol || '--'}</h1>
        {priceData && (
          <span className="text-2xl font-bold tabular-nums">
            {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: priceData.currency,
              minimumFractionDigits: 2,
            }).format(priceData.price)}
          </span>
        )}
      </div>

      {/* Timeframe selector */}
      <TimeframeSelector
        defs={timeframeDefs}
        active={range}
        onChange={setRange}
      />

      {/* Chart type toggle — segmented button per UI-SPEC */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-border bg-surface-1 p-0.5">
          {(['candlestick', 'line'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors duration-150 cursor-pointer',
                chartType === type
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-secondary hover:text-primary hover:bg-surface-2/50'
              )}
            >
              {type === 'candlestick' ? 'Candlestick' : 'Line'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area per UI-SPEC states */}
      <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
        {isPending && <ChartSkeleton />}

        {isError && (
          <div className="p-4">
            <ErrorBanner
              message={error?.message || `Could not load chart data for ${symbol}.`}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {!isPending && !isError && candles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-muted mb-4">
              <svg className="w-12 h-12 mx-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-base text-primary font-medium">
              No chart data available for {symbol}
            </p>
            <p className="text-sm text-secondary mt-1">
              The symbol may not support charting or no data exists for this timeframe.
            </p>
          </div>
        )}

        {!isPending && !isError && candles.length > 0 && (
          <ChartContainer
            data={candles}
            chartType={chartType}
            onInit={handleChartInit}
          />
        )}
      </div>

      {/* Price info bar */}
      <PriceInfoBar
        open={lastCandle?.open ?? null}
        high={lastCandle?.high ?? null}
        low={lastCandle?.low ?? null}
        close={lastCandle?.close ?? null}
        volume={lastCandle?.volume ?? null}
      />
    </div>
  );
}
