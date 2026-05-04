import { Time } from 'lightweight-charts';

export type DrawingTool = 'trendline' | 'horizontal' | 'vertical' | 'ray' | 'text' | 'select' | null;

export interface Point2D {
  time: Time;
  price: number;
}

export interface BaseDrawing {
  id: string;
  color: string;
  lineWidth: number;
}

export interface TrendlineDrawing extends BaseDrawing {
  type: 'trendline';
  point1: Point2D;
  point2: Point2D;
}

export interface HorizontalLineDrawing extends BaseDrawing {
  type: 'horizontal';
  price: number;
}

export interface VerticalLineDrawing extends BaseDrawing {
  type: 'vertical';
  time: Time;
}

export interface RayDrawing extends BaseDrawing {
  type: 'ray';
  point1: Point2D;
  point2: Point2D;
}

export interface TextAnnotation extends BaseDrawing {
  type: 'text';
  time: Time;
  price: number;
  text: string;
}

export type Drawing = TrendlineDrawing | HorizontalLineDrawing | VerticalLineDrawing | RayDrawing | TextAnnotation;

const STORAGE_KEY_PREFIX = 'chart-drawings:';
let idCounter = 0;

export function generateId(): string {
  return `drawing-${Date.now()}-${++idCounter}`;
}

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${symbol}`,
      JSON.stringify(drawings)
    );
  } catch {
    // localStorage full or unavailable -- silently fail
  }
}

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${symbol}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearDrawings(symbol: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${symbol}`);
  } catch {
    // Silently fail
  }
}

// Undo/redo stack (in-memory, not persisted)
export interface DrawingHistory {
  past: Drawing[][];
  future: Drawing[][];
}

export function createDrawingHistory(): DrawingHistory {
  return { past: [], future: [] };
}

export function pushDrawingState(
  history: DrawingHistory,
  current: Drawing[]
): DrawingHistory {
  return {
    past: [...history.past.slice(-49), current],  // Max 50 undo steps
    future: [],
  };
}

export function undoDrawingState(
  history: DrawingHistory,
  current: Drawing[]
): { history: DrawingHistory; drawings: Drawing[] } | null {
  if (history.past.length === 0) return null;
  const prev = history.past[history.past.length - 1];
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
    drawings: prev,
  };
}

export function redoDrawingState(
  history: DrawingHistory,
  current: Drawing[]
): { history: DrawingHistory; drawings: Drawing[] } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    history: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
    drawings: next,
  };
}

export const DRAWING_TOOL_COLORS: Record<string, string> = {
  trendline: '#3B82F6',
  horizontal: '#F59E0B',
  vertical: '#6366F1',
  ray: '#14B8A6',
  text: '#EDEEF0',
};

export const DRAWING_TOOL_DEFAULTS = {
  lineWidth: 2,
  textBackground: '#1A1E27',
  textBorder: '#2A2F3B',
};
