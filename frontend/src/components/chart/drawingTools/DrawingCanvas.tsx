import { useRef, useCallback, useState } from 'react';
import { IChartApi } from 'lightweight-charts';
import {
  Drawing, DrawingTool, Point2D, TrendlineDrawing,
  HorizontalLineDrawing, VerticalLineDrawing, RayDrawing,
  TextAnnotation, generateId, DRAWING_TOOL_COLORS, DRAWING_TOOL_DEFAULTS,
} from './drawingState';

interface DrawingCanvasProps {
  chartApi: IChartApi | null;
  activeTool: DrawingTool;
  drawings: Drawing[];
  onDrawingsChange: (drawings: Drawing[]) => void;
  selectedId: string | null;
  onSelectDrawing: (id: string | null) => void;
  width: number;
  height: number;
}

export function DrawingCanvas({
  chartApi, activeTool, drawings, onDrawingsChange,
  selectedId, onSelectDrawing, width, height,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  // Convert screen coordinates to chart time/price
  const screenToChart = useCallback((clientX: number, clientY: number): Point2D | null => {
    if (!chartApi || !svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time = chartApi.timeScale().coordinateToTime(x);
    const price = chartApi.priceScale('right').coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time: time as number, price };
  }, [chartApi]);

  // Convert chart coordinates to pixel position
  const chartToScreen = useCallback((point: Point2D): { x: number; y: number } | null => {
    if (!chartApi) return null;
    const x = chartApi.timeScale().timeToCoordinate(point.time as any);
    const y = chartApi.priceScale('right').priceToCoordinate(point.price);
    if (x == null || y == null) return null;
    return { x, y };
  }, [chartApi]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!activeTool || activeTool === 'select') return;
    const point = screenToChart(e.clientX, e.clientY);
    if (!point) return;
    setDragStart({ x: e.clientX, y: e.clientY });
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  }, [activeTool, screenToChart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStart || !activeTool || activeTool === 'select') return;
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  }, [dragStart, activeTool]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragStart || !activeTool || activeTool === 'select') return;
    const startPoint = screenToChart(dragStart.x, dragStart.y);
    const endPoint = screenToChart(e.clientX, e.clientY);
    setDragStart(null);
    setCurrentPoint(null);
    if (!startPoint || !endPoint) return;

    const color = DRAWING_TOOL_COLORS[activeTool] || '#3B82F6';

    let newDrawing: Drawing | null = null;
    switch (activeTool) {
      case 'trendline':
        newDrawing = { id: generateId(), type: 'trendline', point1: startPoint, point2: endPoint, color, lineWidth: DRAWING_TOOL_DEFAULTS.lineWidth };
        break;
      case 'horizontal':
        newDrawing = { id: generateId(), type: 'horizontal', price: startPoint.price, color, lineWidth: DRAWING_TOOL_DEFAULTS.lineWidth };
        break;
      case 'vertical':
        newDrawing = { id: generateId(), type: 'vertical', time: startPoint.time, color, lineWidth: DRAWING_TOOL_DEFAULTS.lineWidth };
        break;
      case 'ray':
        newDrawing = { id: generateId(), type: 'ray', point1: startPoint, point2: endPoint, color, lineWidth: DRAWING_TOOL_DEFAULTS.lineWidth };
        break;
      case 'text':
        newDrawing = { id: generateId(), type: 'text', time: startPoint.time, price: startPoint.price, text: 'Annotation', color, lineWidth: DRAWING_TOOL_DEFAULTS.lineWidth };
        break;
    }
    if (newDrawing) {
      onDrawingsChange([...drawings, newDrawing]);
    }
  }, [dragStart, activeTool, screenToChart, drawings, onDrawingsChange]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'select') return;
    // Hit-test drawings (check proximity)
    if (!chartApi) return;
    const point = screenToChart(e.clientX, e.clientY);
    if (!point) return;

    // Find nearest drawing within 10px
    let nearest: { id: string; dist: number } | null = null;
    for (const d of drawings) {
      const dist = distanceToDrawing(d, point, chartApi);
      if (dist < 10 && (!nearest || dist < nearest.dist)) {
        nearest = { id: d.id, dist };
      }
    }
    onSelectDrawing(nearest?.id ?? null);
  }, [activeTool, screenToChart, drawings, chartApi, onSelectDrawing]);

  // Render SVG elements for each drawing
  const renderDrawing = useCallback((d: Drawing) => {
    const isSelected = d.id === selectedId;
    const strokeWidth = isSelected ? d.lineWidth + 1 : d.lineWidth;
    const handleSize = 6;

    switch (d.type) {
      case 'trendline': {
        const p1 = chartToScreen(d.point1);
        const p2 = chartToScreen(d.point2);
        if (!p1 || !p2) return null;
        return (
          <g key={d.id}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={d.color} strokeWidth={strokeWidth} className="cursor-pointer" />
            {isSelected && (
              <>
                <circle cx={p1.x} cy={p1.y} r={handleSize/2} fill={d.color} className="cursor-grab" />
                <circle cx={p2.x} cy={p2.y} r={handleSize/2} fill={d.color} className="cursor-grab" />
              </>
            )}
          </g>
        );
      }
      case 'horizontal': {
        // Render as a line across the full visible range
        // We need time scale bounds, approximate with left/right edges
        return (
          <line key={d.id} x1={0} y1={chartToScreen({ time: 0, price: d.price })?.y ?? 0}
            x2={width} y2={chartToScreen({ time: 0, price: d.price })?.y ?? 0}
            stroke={d.color} strokeWidth={strokeWidth} strokeDasharray={isSelected ? undefined : '4,2'}
            className="cursor-pointer" />
        );
      }
      case 'vertical': {
        return (
          <line key={d.id} x1={chartToScreen({ time: d.time, price: 0 })?.x ?? 0}
            y1={0} x2={chartToScreen({ time: d.time, price: 0 })?.x ?? 0}
            y2={height} stroke={d.color} strokeWidth={strokeWidth}
            strokeDasharray={isSelected ? undefined : '4,2'}
            className="cursor-pointer" />
        );
      }
      case 'ray': {
        const p1 = chartToScreen(d.point1);
        const p2 = chartToScreen(d.point2);
        if (!p1 || !p2) return null;
        // Extend the line beyond p2 to the edge of the chart
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const extendFactor = dx !== 0 ? (dx > 0 ? width / dx : -p1.x / dx) : 1;
        const ex = p2.x + dx * Math.max(extendFactor, 1);
        const ey = p2.y + dy * Math.max(extendFactor, 1);
        return (
          <g key={d.id}>
            <line x1={p1.x} y1={p1.y} x2={Math.max(0, ex)} y2={Math.max(0, ey)}
              stroke={d.color} strokeWidth={strokeWidth} className="cursor-pointer" />
            {isSelected && (
              <>
                <circle cx={p1.x} cy={p1.y} r={handleSize/2} fill={d.color} className="cursor-grab" />
                <circle cx={p2.x} cy={p2.y} r={handleSize/2} fill={d.color} className="cursor-grab" />
              </>
            )}
          </g>
        );
      }
      case 'text': {
        const pos = chartToScreen({ time: d.time, price: d.price });
        if (!pos) return null;
        return (
          <g key={d.id}>
            <rect x={pos.x - 4} y={pos.y - 12} rx={4} ry={4}
              width={d.text.length * 8 + 8} height={22}
              fill={DRAWING_TOOL_DEFAULTS.textBackground}
              stroke={isSelected ? d.color : DRAWING_TOOL_DEFAULTS.textBorder}
              strokeWidth={1} />
            <text x={pos.x} y={pos.y + 4} fill={d.color} fontSize={12}
              fontFamily="Inter, sans-serif" className="select-none">
              {d.text}
            </text>
          </g>
        );
      }
    }
  }, [chartToScreen, selectedId, width, height]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ width: '100%', height: '100%' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      {drawings.map(renderDrawing)}
    </svg>
  );
}

// Helper: distance from a chart point to a drawing (approximate)
function distanceToDrawing(d: Drawing, point: Point2D, chartApi: IChartApi): number {
  // Simplified -- returns large number if cannot be computed
  try {
    switch (d.type) {
      case 'trendline':
      case 'ray': {
        const p1 = chartApi.timeScale().timeToCoordinate(d.point1.time as any);
        const p1y = chartApi.priceScale('right').priceToCoordinate(d.point1.price);
        const p2 = chartApi.timeScale().timeToCoordinate(d.point2.time as any);
        const p2y = chartApi.priceScale('right').priceToCoordinate(d.point2.price);
        if (p1 == null || p1y == null || p2 == null || p2y == null) return 999;
        const px = chartApi.timeScale().timeToCoordinate(point.time as any) ?? 0;
        const py = chartApi.priceScale('right').priceToCoordinate(point.price) ?? 0;
        return pointToLineDist(px, py, p1, p1y, p2, p2y);
      }
      case 'horizontal': {
        const py2 = chartApi.priceScale('right').priceToCoordinate(d.price);
        const ppy = chartApi.priceScale('right').priceToCoordinate(point.price) ?? 0;
        if (py2 == null) return 999;
        return Math.abs(ppy - py2);
      }
      case 'vertical': {
        const px2 = chartApi.timeScale().timeToCoordinate(d.time as any);
        const ppx = chartApi.timeScale().timeToCoordinate(point.time as any) ?? 0;
        if (px2 == null) return 999;
        return Math.abs(ppx - px2);
      }
      case 'text': {
        const tx = chartApi.timeScale().timeToCoordinate(d.time as any);
        const ty = chartApi.priceScale('right').priceToCoordinate(d.price);
        const tpx = chartApi.timeScale().timeToCoordinate(point.time as any) ?? 0;
        const tpy = chartApi.priceScale('right').priceToCoordinate(point.price) ?? 0;
        if (tx == null || ty == null) return 999;
        return Math.sqrt((tpx - tx) ** 2 + (tpy - ty) ** 2);
      }
    }
  } catch { return 999; }
}

function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2);
}
