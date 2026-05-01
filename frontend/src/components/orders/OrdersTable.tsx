import { useState, useMemo } from "react";
import { useOrders, type OrderResponse } from "@/hooks/useOrders";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { cn } from "@/lib/utils";
import { X, ArrowUpDown, Plus } from "lucide-react";

const CANCELLABLE_STATUSES = ["PENDING", "OPEN", "PARTIAL_FILLED"];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  FILLED: { bg: "bg-[#166534]", text: "text-[#22C55E]" },
  CANCELLED: { bg: "bg-[#6B7280]/30", text: "text-[#6B7280]" },
  REJECTED: { bg: "bg-[#7F1D1D]", text: "text-[#EF4444]" },
  PENDING: { bg: "bg-[#1E3A5F]", text: "text-[#60A5FA]" },
  OPEN: { bg: "bg-[#1E3A5F]", text: "text-[#60A5FA]" },
  PARTIAL_FILLED: { bg: "bg-[#78350F]", text: "text-[#F59E0B]" },
  EXPIRED: { bg: "bg-[#6B7280]/30", text: "text-[#6B7280]" },
};

interface OrdersTableProps {
  onCancel: (order: OrderResponse) => void;
  onPlaceOrder: () => void;
}

type SortField = "symbol" | "side" | "order_type" | "quantity" | "status" | "created_at";

export function OrdersTable({ onCancel, onPlaceOrder }: OrdersTableProps) {
  const { data: orders, isPending, isError, error, refetch } = useOrders();
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    if (!orders) return [];
    return [...orders].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = typeof aVal === "string"
        ? String(aVal).localeCompare(String(bVal))
        : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orders, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={cn("text-xs font-semibold text-muted px-3 py-2 text-left cursor-pointer hover:text-primary transition-colors duration-150 select-none", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          <span className="text-info text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  if (isPending) return <TableSkeleton rows={5} columns={7} />;
  if (isError) return <ErrorBanner message={error?.message || "Could not load orders"} onRetry={() => refetch()} />;
  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-base font-semibold text-primary mb-2">No orders yet</p>
        <p className="text-sm text-secondary mb-6">Place your first order to get started.</p>
        <button
          onClick={onPlaceOrder}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-info text-info-foreground text-sm font-medium hover:bg-[#2563EB] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-info/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-subtle">
            <SortHeader field="symbol" label="Symbol" />
            <SortHeader field="side" label="Side" />
            <SortHeader field="order_type" label="Type" />
            <SortHeader field="quantity" label="Qty" />
            <th className="text-xs font-semibold text-muted px-3 py-2 text-left">Filled</th>
            <th className="text-xs font-semibold text-muted px-3 py-2 text-left">Price</th>
            <SortHeader field="status" label="Status" />
            <SortHeader field="created_at" label="Date" />
            <th className="text-xs font-semibold text-muted px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => {
            const style = STATUS_STYLES[order.status] || STATUS_STYLES.PENDING;
            return (
              <tr key={order.id} className="border-b border-border-subtle hover:bg-surface-1 transition-colors duration-150">
                <td className="px-3 py-2 text-sm font-medium">{order.symbol}</td>
                <td className={cn("px-3 py-2 text-sm font-medium", order.side === "BUY" ? "text-positive" : "text-negative")}>
                  {order.side}
                </td>
                <td className="px-3 py-2 text-sm text-secondary">{order.order_type}</td>
                <td className="px-3 py-2 text-sm tabular-nums">{Number(order.quantity).toFixed(4)}</td>
                <td className="px-3 py-2 text-sm tabular-nums">{Number(order.filled_quantity).toFixed(4)}</td>
                <td className="px-3 py-2 text-sm tabular-nums">
                  {order.price ? `₹${Number(order.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "---"}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", style.bg, style.text)}>
                    {order.status === "PARTIAL_FILLED" ? "PARTIAL" : order.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-secondary">
                  {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2">
                  {CANCELLABLE_STATUSES.includes(order.status) && (
                    <button
                      onClick={() => onCancel(order)}
                      className="text-muted hover:text-negative transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-negative/60 rounded cursor-pointer"
                      aria-label={`Cancel order ${order.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
