import { SummaryCards } from "@/components/portfolio/SummaryCards";
import { PositionsTable } from "@/components/portfolio/PositionsTable";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Portfolio</h1>
      <SummaryCards />
      <div>
        <h2 className="text-base font-semibold mb-4">Positions</h2>
        <PositionsTable />
      </div>
    </div>
  );
}
