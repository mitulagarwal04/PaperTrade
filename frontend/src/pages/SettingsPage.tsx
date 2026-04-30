import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

export default function SettingsPage() {
  const [showReset, setShowReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const queryClient = useQueryClient();

  const handleReset = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await api.post("/api/v1/portfolio/reset", { confirm: true });
      setResetDone(true);
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      setResetError((err as Error)?.message || "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="bg-surface-1 border border-border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-1">Portfolio</h2>
          <p className="text-sm text-secondary">
            Reset your portfolio to start fresh. This will liquidate all positions and reset cash to 100,000 INR.
          </p>
        </div>

        {resetError && (
          <ErrorBanner message={resetError} onDismiss={() => setResetError(null)} />
        )}

        {resetDone ? (
          <div className="text-sm text-positive">
            Portfolio has been reset. Your cash balance is now 100,000 INR.
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setShowReset(true)}
            className="bg-destructive text-destructive-foreground hover:bg-[#B91C1C] cursor-pointer"
          >
            Reset Portfolio
          </Button>
        )}
      </div>

      <Dialog open={showReset} onOpenChange={(o) => !o && setShowReset(false)}>
        <DialogContent className="bg-surface-1 border border-border text-primary">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Reset Portfolio</DialogTitle>
            <DialogDescription className="text-sm text-secondary mt-2">
              This will liquidate all positions, clear trade history, and reset cash to 100,000 INR. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowReset(false)}
              className="border-border text-secondary hover:text-primary"
            >
              Keep Portfolio
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-[#B91C1C]"
            >
              {isResetting ? "Resetting..." : "Reset Portfolio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
