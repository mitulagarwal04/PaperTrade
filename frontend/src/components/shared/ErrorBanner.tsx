import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, onDismiss, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-md bg-[#2D1517] border border-negative/30",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-negative" />
        <p className="text-sm text-negative truncate">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-info hover:underline transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded cursor-pointer"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-sm text-muted hover:text-primary transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
