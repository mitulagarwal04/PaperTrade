import { ChartRange } from '@/lib/types/chart';
import { cn } from '@/lib/utils';

interface TimeframeDef {
  label: string;
  value: ChartRange;
}

interface TimeframeSelectorProps {
  defs: TimeframeDef[];
  active: ChartRange;
  onChange: (value: ChartRange) => void;
}

export function TimeframeSelector({ defs, active, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {defs.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={cn(
            'px-3 h-7 rounded text-sm font-medium transition-colors duration-150 cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            active === tf.value
              ? 'bg-surface-3 font-semibold text-primary'
              : 'text-secondary hover:text-primary hover:bg-surface-2'
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
