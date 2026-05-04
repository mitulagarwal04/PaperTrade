/** Active indicator badge with remove (X) button. */

import { X } from 'lucide-react';
import { CHART_INDICATOR_COLORS } from '@/lib/constants';
import { INDICATOR_DEFS } from './IndicatorDropdown';

interface IndicatorChipProps {
  id: string;
  onRemove: (id: string) => void;
}

export function IndicatorChip({ id, onRemove }: IndicatorChipProps) {
  const def = INDICATOR_DEFS.find(d => d.id === id);
  const color = CHART_INDICATOR_COLORS[id.toLowerCase() as keyof typeof CHART_INDICATOR_COLORS] || '#6B7280';

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 border border-border">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {def?.label || id}
      <button
        onClick={() => onRemove(id)}
        className="ml-0.5 text-muted hover:text-primary transition-colors cursor-pointer"
        aria-label={`Remove ${def?.label || id}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
