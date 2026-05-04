import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickData, LineData, Time } from 'lightweight-charts';
import { CandleData, ChartType } from '@/lib/types/chart';
import { CHART_CANDLE_COLORS } from '@/lib/constants';

export interface ChartContainerAPI {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;
  container: HTMLDivElement | null;
}

interface ChartContainerProps {
  data: CandleData[];
  chartType?: ChartType;
  height?: number;
  onInit?: (api: ChartContainerAPI) => void;
}

function convertToCandlestick(data: CandleData[]): CandlestickData[] {
  return data.map((c) => ({
    time: c.time as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function convertToLine(data: CandleData[]): LineData[] {
  return data.map((c) => ({
    time: c.time as Time,
    value: c.close,
  }));
}

export function ChartContainer({
  data,
  chartType = 'candlestick',
  height = 500,
  onInit,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;

  // Mount effect: create chart instance, series, and ResizeObserver once.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#13161C' },
        textColor: '#A0A5B0',
      },
      grid: {
        vertLines: { color: 'rgba(42, 47, 59, 0.5)' },
        horzLines: { color: 'rgba(42, 47, 59, 0.5)' },
      },
      crosshair: {
        color: 'rgba(237, 238, 240, 0.3)',
        labelBackgroundColor: '#232833',
      },
      timeScale: {
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
      rightPriceScale: {
        scaleMargins: { top: 0.1, bottom: 0.2 },
        mode: 2, // PriceScaleMode.Normal
      },
    });

    // Create initial series based on chartType
    const series = chartType === 'line'
      ? chart.addLineSeries({ color: '#3B82F6', lineWidth: 2 })
      : chart.addCandlestickSeries({
          upColor: CHART_CANDLE_COLORS.up,
          downColor: CHART_CANDLE_COLORS.down,
          borderDownColor: CHART_CANDLE_COLORS.down,
          borderUpColor: CHART_CANDLE_COLORS.up,
          wickDownColor: CHART_CANDLE_COLORS.down,
          wickUpColor: CHART_CANDLE_COLORS.up,
        });

    chartRef.current = chart;
    seriesRef.current = series;

    // ResizeObserver for responsive chart width
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    // Call onInit with the chart API
    onInitRef.current?.({
      chart,
      series,
      container: containerRef.current,
    });

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Intentionally empty deps — chart created once on mount.
    // height is included so the effect re-runs if height changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data effect: update series data whenever data array changes.
  // Does NOT re-create chart — calls series.setData() only.
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    if (chartType === 'line') {
      (seriesRef.current as ISeriesApi<'Line'>).setData(convertToLine(data));
    } else {
      (seriesRef.current as ISeriesApi<'Candlestick'>).setData(convertToCandlestick(data));
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, chartType]);

  // Chart type effect: swap series when chartType changes.
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const isCurrentlyCandlestick = chartType === 'candlestick';
    const isCurrentlyLine = chartType === 'line';

    // Only swap if the current series type doesn't match the target
    if (
      (isCurrentlyCandlestick && seriesRef.current.seriesType() === 'Candlestick') ||
      (isCurrentlyLine && seriesRef.current.seriesType() === 'Line')
    ) {
      return;
    }

    // Remove old series
    chartRef.current.removeSeries(seriesRef.current);

    // Add new series
    const newSeries = chartType === 'line'
      ? chartRef.current.addLineSeries({ color: '#3B82F6', lineWidth: 2 })
      : chartRef.current.addCandlestickSeries({
          upColor: CHART_CANDLE_COLORS.up,
          downColor: CHART_CANDLE_COLORS.down,
          borderDownColor: CHART_CANDLE_COLORS.down,
          borderUpColor: CHART_CANDLE_COLORS.up,
          wickDownColor: CHART_CANDLE_COLORS.down,
          wickUpColor: CHART_CANDLE_COLORS.up,
        });

    // Set data on new series
    if (chartType === 'line') {
      newSeries.setData(convertToLine(data));
    } else {
      newSeries.setData(convertToCandlestick(data));
    }

    seriesRef.current = newSeries;
    chartRef.current.timeScale().fitContent();

    onInitRef.current?.({
      chart: chartRef.current,
      series: newSeries,
      container: containerRef.current,
    });
  }, [chartType, data]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
