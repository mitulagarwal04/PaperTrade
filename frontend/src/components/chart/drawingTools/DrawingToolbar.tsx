import {
  TrendingUp, Minus, SeparatorHorizontal, ArrowUpRight,
  Type, MousePointer2, RotateCcw, RotateCw, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrawingTool } from './drawingState';

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

const toolDefs: {
  tool: Exclude<DrawingTool, null>;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select (V)' },
  { tool: 'trendline', icon: TrendingUp, label: 'Trendline' },
  { tool: 'horizontal', icon: Minus, label: 'Horizontal Line' },
  { tool: 'vertical', icon: SeparatorHorizontal, label: 'Vertical Line' },
  { tool: 'ray', icon: ArrowUpRight, label: 'Ray' },
  { tool: 'text', icon: Type, label: 'Text' },
];

const actionDefs: {
  key: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}[] = [];

export function DrawingToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onDeleteSelected,
  canUndo,
  canRedo,
  hasSelection,
}: DrawingToolbarProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-2 py-1.5 select-none">
      {/* Drawing tool buttons */}
      {toolDefs.map(({ tool, icon: Icon, label }) => (
        <button
          key={tool}
          title={label}
          onClick={() => onToolChange(activeTool === tool ? null : tool)}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 cursor-pointer',
            activeTool === tool
              ? 'bg-surface-3 ring-1 ring-info/60 text-primary'
              : 'text-secondary hover:text-primary hover:bg-surface-2/50'
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-0.5" />

      {/* Action buttons */}
      <button
        title="Undo"
        onClick={onUndo}
        disabled={!canUndo}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 cursor-pointer',
          canUndo
            ? 'text-secondary hover:text-primary hover:bg-surface-2/50'
            : 'text-muted cursor-not-allowed opacity-40'
        )}
      >
        <RotateCcw size={16} aria-hidden="true" />
      </button>

      <button
        title="Redo"
        onClick={onRedo}
        disabled={!canRedo}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 cursor-pointer',
          canRedo
            ? 'text-secondary hover:text-primary hover:bg-surface-2/50'
            : 'text-muted cursor-not-allowed opacity-40'
        )}
      >
        <RotateCw size={16} aria-hidden="true" />
      </button>

      <button
        title="Delete selected drawing"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150 cursor-pointer',
          hasSelection
            ? 'text-secondary hover:text-red-400 hover:bg-red-500/10'
            : 'text-muted cursor-not-allowed opacity-40'
        )}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
