import { cn } from '@/lib/utils';

interface PriceInfoBarProps {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume?: number | null;
  className?: string;
}

const formatPrice = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

const formatVolume = (val: number): string => {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return val.toString();
};

export function PriceInfoBar({
  open,
  high,
  low,
  close,
  volume,
  className,
}: PriceInfoBarProps) {
  const hasData = open != null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 text-xs tabular-nums text-secondary',
        className,
      )}
    >
      {hasData ? (
        <>
          <span>
            <span className="text-muted">O:</span> {formatPrice(open!)}
          </span>
          <span>
            <span className="text-muted">H:</span> {formatPrice(high!)}
          </span>
          <span>
            <span className="text-muted">L:</span> {formatPrice(low!)}
          </span>
          <span>
            <span className="text-muted">C:</span> {formatPrice(close!)}
          </span>
          {volume != null && (
            <span>
              <span className="text-muted">Vol:</span> {formatVolume(volume)}
            </span>
          )}
        </>
      ) : (
        <span className="text-muted">No data</span>
      )}
    </div>
  );
}
