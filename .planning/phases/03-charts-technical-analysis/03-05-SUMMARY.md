---
phase: 03
plan: 05
subsystem: chart-drawing-tools
tags:
  - drawing
  - chart
  - toolbar
  - localStorage
  - keyboard-shortcuts
requires:
  - Plan 03-04 (chart indicators)
  - lightweight-charts (chart API)
  - lucide-react (icons)
provides:
  - DrawingToolbar component
  - DrawingCanvas overlay
  - drawing state persistence
affects:
  - ChartPage.tsx
  - drawingTools/drawingState.ts
  - drawingTools/DrawingCanvas.tsx
  - drawingTools/DrawingToolbar.tsx
tech-stack:
  added: []
  patterns:
    - SVG overlay for chart annotations
    - localStorage persistence for user state
    - undo/redo via immutable history stack
    - ResizeObserver for overlay dimensions
key-files:
  created:
    - frontend/src/components/chart/drawingTools/DrawingState.ts
    - frontend/src/components/chart/drawingTools/DrawingCanvas.tsx
    - frontend/src/components/chart/drawingTools/DrawingToolbar.tsx
  modified:
    - frontend/src/pages/ChartPage.tsx
decisions:
  - SVG overlay approach over Primitive API for drawing tools (simpler, sufficient for v1)
  - Undo/redo stack in memory only (not persisted to localStorage)
  - Debounced localStorage save (500ms) to avoid thrashing on rapid drawing
  - useRef for history to avoid re-render overhead on undo/redo operations
metrics:
  duration: ~45m
  completed: "2026-05-05"
  tasks: 3/3
  test_status: N/A (UI components, no automated tests)
---

# Phase 3 Plan 5: Drawing Tools Summary

Drawing tools for manual chart analysis with session persistence. Users can draw trendlines, horizontal/vertical lines, rays, and text annotations on the chart with toolbar-based tool selection, undo/redo, and selection/deletion.

## Files Created

- **`frontend/src/components/chart/drawingTools/drawingState.ts`** — Drawing type definitions (Drawing, Trendline, HorizontalLine, VerticalLine, Ray, TextAnnotation), localStorage persistence (save/load/clear), undo/redo history stack utilities
- **`frontend/src/components/chart/drawingTools/DrawingCanvas.tsx`** — SVG overlay component that maps chart time/price coordinates to screen pixels. Handles mouse-based drawing creation, hit-test selection, and renders all drawings with SVG primitives
- **`frontend/src/components/chart/drawingTools/DrawingToolbar.tsx`** — Icon button row with tool selection (select/trendline/horizontal/vertical/ray/text), undo/redo, and delete actions. Active tool highlighted with bg-surface-3 + ring-1 ring-info/60

## Files Modified

- **`frontend/src/pages/ChartPage.tsx`** — Integrated DrawingToolbar (right-aligned above chart area) and DrawingCanvas overlay (inside chart container). Added drawing state management, keyboard shortcuts (Escape/Delete/Backspace), debounced localStorage persistence, ResizeObserver for canvas dimensions, history reset on symbol change

## Deviations from Plan

None - plan executed exactly as written.

## Key Design Decisions

- **SVG overlay approach**: Rather than using lightweight-charts Primitive API (which is newer and less documented), we use an absolutely-positioned SVG overlay. This is simpler and sufficient for v1 drawing tools. The overlay maps between chart time/price coordinates and screen pixels using the chart API's coordinate conversion methods.
- **In-memory undo/redo**: History stack is stored in a ref (not persisted to localStorage) to keep the persistence layer simple. Max 50 undo steps.
- **Functional updater pattern**: Undo/redo handlers use React's functional `setState` pattern to avoid stale closure issues and eliminate dependency arrays on `drawings`.
- **Ref-based keyboard shortcuts**: A ref sync pattern (`selectedIdRef`) avoids stale closure issues in the keyboard event listener, allowing an empty dependency array in `useEffect`.

## Self-Check: PASSED

- [x] DrawingToolbar.tsx created with tool icons, undo/redo/delete, active tool styling
- [x] ChartPage.tsx integrates DrawingToolbar and DrawingCanvas
- [x] Drawing state management with undo/redo history
- [x] Keyboard shortcuts: Escape deselects, Delete/Backspace removes selected
- [x] Debounced localStorage persistence on drawings change
- [x] Drawing state reset on symbol change
- [x] TypeScript check passes with zero errors
