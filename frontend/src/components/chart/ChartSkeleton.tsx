import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { cn } from '@/lib/utils';

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div className={cn('w-full aspect-[16/9] lg:aspect-[16/9] md:aspect-[4/3] relative overflow-hidden', className)}>
      {/* Price axis skeletons (right side) */}
      <div className="absolute right-3 top-3 flex flex-col gap-3 items-end">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-12" />
        ))}
      </div>
      {/* Chart shape simulation */}
      <div className="absolute inset-0 flex flex-col justify-center px-12">
        <div className="space-y-4">
          {[90, 70, 85, 55, 75, 60, 80].map((width, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton
                className="h-6 rounded-sm"
                style={{ width: `${width}%`, height: `${16 + Math.sin(i) * 8}px` }}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Time axis skeleton (bottom) */}
      <div className="absolute bottom-3 left-12 right-12 flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
  );
}
