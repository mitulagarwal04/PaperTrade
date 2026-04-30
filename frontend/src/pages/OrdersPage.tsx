import { useState } from "react";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrderForm } from "@/components/orders/OrderForm";
import { CancelDialog } from "@/components/orders/CancelDialog";
import type { OrderResponse } from "@/hooks/useOrders";

export default function OrdersPage() {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<OrderResponse | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <button
          onClick={() => setOrderFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-info text-info-foreground text-sm font-medium hover:bg-[#2563EB] transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          + Place Order
        </button>
      </div>
      <OrdersTable
        onCancel={(order) => setCancellingOrder(order)}
        onPlaceOrder={() => setOrderFormOpen(true)}
      />
      <OrderForm
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
      />
      <CancelDialog
        order={cancellingOrder}
        onClose={() => setCancellingOrder(null)}
      />
    </div>
  );
}
