import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCancelOrder } from "@/hooks/useOrderMutations";
import type { OrderResponse as OrderResp } from "@/hooks/useOrders";

interface CancelDialogProps {
  order: OrderResp | null;
  onClose: () => void;
}

export function CancelDialog({ order, onClose }: CancelDialogProps) {
  const cancelMutation = useCancelOrder();
  const isOpen = order !== null;

  const handleCancel = () => {
    if (!order) return;
    cancelMutation.mutate(order.id, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface-1 border border-border text-primary">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Cancel Order</DialogTitle>
          <DialogDescription className="text-sm text-secondary mt-2">
            {order
              ? `Are you sure you want to cancel this ${order.symbol} ${order.side} order for ${Number(order.quantity).toFixed(4)} shares?`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-secondary hover:text-primary"
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-[#B91C1C]"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Order"}
          </Button>
        </DialogFooter>
        {cancelMutation.isError && (
          <p className="text-sm text-negative mt-2">
            Order could not be cancelled: {(cancelMutation.error as Error)?.message || "Unknown error"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
