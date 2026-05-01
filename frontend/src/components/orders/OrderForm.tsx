import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlaceOrder } from "@/hooks/useOrderMutations";
import type { PlaceOrderParams } from "@/hooks/useOrderMutations";
import { usePriceStore } from "@/stores/priceStore";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OrderFormProps {
  open: boolean;
  onClose: () => void;
}

export function OrderForm({ open, onClose }: OrderFormProps) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<string>("MARKET");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [validationError, setValidationError] = useState("");

  const placeOrder = usePlaceOrder();
  const referencePrice = usePriceStore((state) =>
    symbol ? state.prices[symbol.toUpperCase()]?.price : undefined
  );

  const handleSubmit = async () => {
    setValidationError("");

    const sym = symbol.toUpperCase().trim();
    if (!sym) { setValidationError("Symbol is required"); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { setValidationError("Quantity must be a positive number"); return; }

    if (orderType === "LIMIT" && (!price || parseFloat(price) <= 0)) {
      setValidationError("Price is required for limit orders");
      return;
    }
    if (["STOP_LOSS", "TAKE_PROFIT"].includes(orderType) && (!stopPrice || parseFloat(stopPrice) <= 0)) {
      setValidationError("Stop price is required for this order type");
      return;
    }

    const params: PlaceOrderParams = {
      symbol: sym,
      side,
      order_type: orderType as PlaceOrderParams["order_type"],
      quantity: qty,
    };
    if (orderType === "LIMIT" && price) params.price = parseFloat(price);
    if (["STOP_LOSS", "TAKE_PROFIT"].includes(orderType) && stopPrice) params.stop_price = parseFloat(stopPrice);

    placeOrder.mutate(params, {
      onSuccess: () => {
        toast({
          title: "Order placed",
          description: `${side} ${orderType} order for ${quantity} ${sym} submitted successfully.`,
        });
        setSymbol("");
        setQuantity("");
        setPrice("");
        setStopPrice("");
        setSide("BUY");
        setOrderType("MARKET");
        onClose();
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] bg-surface-1 border-l border-border text-primary p-6 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">Place Order</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Symbol</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="bg-surface-3 border-border text-primary"
            />
            {referencePrice !== undefined && (
              <p className="text-xs text-secondary">
                Ref: ₹{Number(referencePrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Side</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide("BUY")}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer",
                  side === "BUY"
                    ? "bg-positive text-positive-foreground"
                    : "bg-surface-3 text-secondary hover:bg-surface-2"
                )}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide("SELL")}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer",
                  side === "SELL"
                    ? "bg-negative text-negative-foreground"
                    : "bg-surface-3 text-secondary hover:bg-surface-2"
                )}
              >
                SELL
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Order Type</label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="bg-surface-3 border-border text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-border text-primary">
                <SelectItem value="MARKET">Market</SelectItem>
                <SelectItem value="LIMIT">Limit</SelectItem>
                <SelectItem value="STOP_LOSS">Stop Loss</SelectItem>
                <SelectItem value="TAKE_PROFIT">Take Profit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Quantity</label>
            <Input
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="bg-surface-3 border-border text-primary"
            />
          </div>

          {orderType === "LIMIT" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Price (INR)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="bg-surface-3 border-border text-primary"
              />
            </div>
          )}

          {["STOP_LOSS", "TAKE_PROFIT"].includes(orderType) && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Stop Price (INR)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="0.00"
                className="bg-surface-3 border-border text-primary"
              />
            </div>
          )}

          {validationError && (
            <p className="text-sm text-negative">{validationError}</p>
          )}

          {placeOrder.isError && (
            <p className="text-sm text-negative">
              Order could not be placed: {(placeOrder.error as Error)?.message || "Unknown error"}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={placeOrder.isPending}
            className={cn(
              "w-full py-2 text-sm font-medium cursor-pointer",
              side === "BUY"
                ? "bg-positive text-positive-foreground hover:bg-[#16A34A]"
                : "bg-negative text-negative-foreground hover:bg-[#DC2626]"
            )}
          >
            {placeOrder.isPending
              ? "Placing Order..."
              : `Place ${side} Order`
            }
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
