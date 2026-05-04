import { useRef, useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { usePriceStore } from '@/stores/priceStore';
import { useChartData } from '@/hooks/useChartData';
import { useTimeframe } from '@/hooks/useTimeframe';
import { useCandleAggregator } from '@/hooks/useCandleAggregator';
import { ChartContainer, ChartContainerAPI } from '@/components/chart/ChartContainer';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';
import { PriceInfoBar } from '@/components/chart/PriceInfoBar';
import { ChartSkeleton } from '@/components/chart/ChartSkeleton';
import { ErrorBanner } from '@/components/shared/ErrorBanner';
import { IndicatorDropdown } from '@/components/chart/IndicatorDropdown';
import { IndicatorChip } from '@/components/chart/IndicatorChip';
import { DrawingToolbar } from '@/components/chart/drawingTools/DrawingToolbar';
import { DrawingCanvas } from '@/components/chart/drawingTools/DrawingCanvas';
import {
  type Drawing, type DrawingTool, type DrawingHistory,
  createDrawingHistory, pushDrawingState, undoDrawingState, redoDrawingState,
  saveDrawings, loadDrawings,
} from '@/components/chart/drawingTools/drawingState';
import { calcSMA, calcEMA, calcRSI, calcBollingerBands, calcMACD, calcVolumeProfile } from '@/lib/indicatorUtils';
import { CHART_INDICATOR_COLORS } from '@/lib/constants';
import { rangeToInterval } from '@/lib/candleUtils';
import { cn } from '@/lib/utils';
import type { CandleData } from '@/lib/types/chart';

export default function ChartPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { range, setRange, timeframeDefs } = useTimeframe('1mo');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');

  const { data, isPending, isError, error, refetch } = useChartData(symbol || '', range);
  const prices = usePriceStore((s) => s.prices);
  const priceData = symbol ? prices[symbol] : undefined;

  // --- Drawing state ---
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const historyRef = useRef<DrawingHistory>(createDrawingHistory());
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  // ResizeObserver to track chart container dimensions for DrawingCanvas
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load drawings from localStorage on mount and when symbol changes
  useEffect(() => {
    if (!symbol) return;
    const saved = loadDrawings(symbol);
    setDrawings(saved);
    setSelectedId(null);
    setActiveTool(null);
    historyRef.current = createDrawingHistory();
  }, [symbol]);

  // Debounced save to localStorage when drawings change
  useEffect(() => {
    if (!symbol) return;
    const timer = setTimeout(() => {
      saveDrawings(symbol, drawings);
    }, 500);
    return () => clearTimeout(timer);
  }, [drawings, symbol]);

  // Keyboard shortcuts: Delete/Backspace to remove selected, Escape to deselect
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool(null);
        setSelectedId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        const idToDelete = selectedIdRef.current;
        setDrawings((prev) => {
          historyRef.current = pushDrawingState(historyRef.current, prev);
          return prev.filter((d) => d.id !== idToDelete);
        });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDrawingsChange = useCallback((newDrawings: Drawing[]) => {
    setDrawings((prev) => {
      historyRef.current = pushDrawingState(historyRef.current, prev);
      return newDrawings;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setDrawings((prev) => {
      const result = undoDrawingState(historyRef.current, prev);
      if (!result) return prev;
      historyRef.current = result.history;
      return result.drawings;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setDrawings((prev) => {
      const result = redoDrawingState(historyRef.current, prev);
      if (!result) return prev;
      historyRef.current = result.history;
      return result.drawings;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    setSelectedId((prevId) => {
      if (!prevId) return prevId;
      setDrawings((prev) => {
        historyRef.current = pushDrawingState(historyRef.current, prev);
        return prev.filter((d) => d.id !== prevId);
      });
      return null;
    });
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  // --- Indicator state ---
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const indicatorSeriesRef = useRef<Record<string, any>>({});

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators(prev => {
      const isActive = prev.includes(id);
      if (isActive) {
        // Remove indicator from chart
        const series = indicatorSeriesRef.current[id];
        if (series && chartApiRef.current) {
          if (Array.isArray(series)) {
            series.forEach((s: any) => {
              try { chartApiRef.current!.removeSeries(s); } catch {}
            });
          } else {
            try { chartApiRef.current.removeSeries(series); } catch {}
          }
        }
        delete indicatorSeriesRef.current[id];
        return prev.filter(i => i !== id);
      } else {
        // Add indicator to chart
        if (chartApiRef.current && candles.length > 0) {
          addIndicatorToChart(id, candles, chartApiRef.current, indicatorSeriesRef.current);
        }
        return [...prev, id];
      }
    });
  }, [candles, chartApiRef.current]);

  // --- Indicator overlay helpers ---
  function addIndicatorToChart(
    id: string,
    candleData: CandleData[],
    chart: IChartApi,
    seriesRef: Record<string, any>,
  ) {
    switch (id) {
      case 'SMA': {
        const values = calcSMA(candleData, 20);
        const series = chart.addLineSeries({
          color: CHART_INDICATOR_COLORS.sma,
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false,
        });
        series.setData(values.map(v => ({ time: v.time as Time, value: v.value })));
        seriesRef['SMA'] = series;
        break;
      }
      case 'EMA': {
        const values = calcEMA(candleData, 20);
        const series = chart.addLineSeries({
          color: CHART_INDICATOR_COLORS.ema,
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false,
        });
        series.setData(values.map(v => ({ time: v.time as Time, value: v.value })));
        seriesRef['EMA'] = series;
        break;
      }
      case 'RSI': {
        const values = calcRSI(candleData, 14);
        const series = chart.addLineSeries({
          color: CHART_INDICATOR_COLORS.rsi,
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false,
          priceScaleId: 'rsi',
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(0) },
        });
        chart.priceScale('rsi').applyOptions({
          scaleMargins: { top: 0.7, bottom: 0.15 },
        });
        series.setData(values.map(v => ({ time: v.time as Time, value: v.value })));
        seriesRef['RSI'] = series;
        break;
      }
      case 'BB': {
        const { upper, middle, lower } = calcBollingerBands(candleData, 20, 2);
        const color = CHART_INDICATOR_COLORS.bollinger;
        const upperSeries = chart.addLineSeries({
          color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
        });
        upperSeries.setData(upper.map(v => ({ time: v.time as Time, value: v.value })));
        const middleSeries = chart.addLineSeries({
          color: color + '99', lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
        });
        middleSeries.setData(middle.map(v => ({ time: v.time as Time, value: v.value })));
        const lowerSeries = chart.addLineSeries({
          color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
        });
        lowerSeries.setData(lower.map(v => ({ time: v.time as Time, value: v.value })));
        seriesRef['BB'] = [upperSeries, middleSeries, lowerSeries];
        break;
      }
      case 'MACD': {
        const { macd, signal, histogram } = calcMACD(candleData);
        const macdSeries = chart.addLineSeries({
          color: CHART_INDICATOR_COLORS.macd, lineWidth: 1, lastValueVisible: true, priceLineVisible: false,
          priceScaleId: 'macd',
        });
        macdSeries.setData(macd.map(v => ({ time: v.time as Time, value: v.value })));
        const signalSeries = chart.addLineSeries({
          color: CHART_INDICATOR_COLORS.macdSignal, lineWidth: 1, lastValueVisible: true, priceLineVisible: false,
          priceScaleId: 'macd',
        });
        signalSeries.setData(signal.map(v => ({ time: v.time as Time, value: v.value })));
        const histSeries = chart.addHistogramSeries({
          color: CHART_INDICATOR_COLORS.macdHistogram, priceFormat: { type: 'volume' },
          priceScaleId: 'macd',
        });
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        histSeries.setData(histogram.map(v => ({
          time: v.time as Time,
          value: v.value,
          color: v.value >= 0 ? '#22C55E' : '#EF4444',
        })));
        seriesRef['MACD'] = [macdSeries, signalSeries, histSeries];
        break;
      }
      case 'VOL': {
        const values = calcVolumeProfile(candleData);
        const series = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        series.setData(values.map(v => ({
          time: v.time as Time,
          value: v.value,
          color: v.value > 0 ? '#22C55E66' : '#EF444466',
        })));
        seriesRef['VOL'] = series;
        break;
      }
    }
  }

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

      {/* Indicator toolbar per UI-SPEC layout */}
      <div className="flex items-center gap-2 flex-wrap">
        <IndicatorDropdown
          active={activeIndicators}
          onToggle={toggleIndicator}
        />
        {activeIndicators.map((id) => (
          <IndicatorChip key={id} id={id} onRemove={toggleIndicator} />
        ))}
      </div>

      {/* Drawing toolbar — right-aligned above chart */}
      <div className="flex justify-end">
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDeleteSelected={handleDeleteSelected}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selectedId !== null}
        />
      </div>

      {/* Chart area per UI-SPEC states */}
      <div ref={chartContainerRef} className="bg-surface-1 border border-border rounded-lg overflow-hidden relative">
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
          <>
            <ChartContainer
              data={candles}
              chartType={chartType}
              onInit={handleChartInit}
            />
            {chartApiRef.current && chartSize.width > 0 && (
              <DrawingCanvas
                chartApi={chartApiRef.current}
                activeTool={activeTool}
                drawings={drawings}
                onDrawingsChange={handleDrawingsChange}
                selectedId={selectedId}
                onSelectDrawing={setSelectedId}
                width={chartSize.width}
                height={chartSize.height || 500}
              />
            )}
          </>
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
