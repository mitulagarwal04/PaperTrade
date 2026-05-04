/** Indicator toggle dropdown using shadcn DropdownMenuCheckboxItem. */

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export interface IndicatorDef {
  id: string;
  label: string;
  category: 'trend' | 'oscillator' | 'volume';
}

const INDICATOR_DEFS: IndicatorDef[] = [
  { id: 'SMA', label: 'MA (Simple)', category: 'trend' },
  { id: 'EMA', label: 'MA (Exponential)', category: 'trend' },
  { id: 'RSI', label: 'RSI', category: 'oscillator' },
  { id: 'MACD', label: 'MACD', category: 'oscillator' },
  { id: 'BB', label: 'Bollinger Bands', category: 'trend' },
  { id: 'VOL', label: 'Volume', category: 'volume' },
];

export { INDICATOR_DEFS };

interface IndicatorDropdownProps {
  active: string[];
  onToggle: (id: string) => void;
}

export function IndicatorDropdown({ active, onToggle }: IndicatorDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          Indicators
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Indicators</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {INDICATOR_DEFS.map((ind) => (
          <DropdownMenuCheckboxItem
            key={ind.id}
            checked={active.includes(ind.id)}
            onCheckedChange={() => onToggle(ind.id)}
          >
            {ind.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
