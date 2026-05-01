import { SummaryCards } from "@/components/portfolio/SummaryCards";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <SummaryCards />
      <div className="bg-surface-1 border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-secondary">
          Full dashboard with charts and analytics coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
