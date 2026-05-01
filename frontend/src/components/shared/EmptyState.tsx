import { cn } from "@/lib/utils";

interface EmptyStateProps {
  heading: string;
  body: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ heading, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <h3 className="text-base font-semibold text-primary mb-2">{heading}</h3>
      <p className="text-sm text-secondary max-w-md mb-6">{body}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 rounded-md bg-info text-info-foreground text-sm font-medium hover:bg-[#2563EB] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
