import { useAssets } from "@/hooks/useAssets";
import { AssetPriceRow } from "@/components/assets/AssetPriceRow";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

export default function AssetsPage() {
  const { data: assets, isPending, isError, error, refetch } = useAssets();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Assets</h1>
      <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
        {isPending && <TableSkeleton rows={6} columns={2} />}
        {isError && (
          <ErrorBanner
            message={error?.message || "Could not load assets"}
            onRetry={() => refetch()}
          />
        )}
        {assets && assets.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-secondary">No assets tracked</p>
          </div>
        )}
        {assets && assets.map((asset) => (
          <AssetPriceRow
            key={asset.symbol}
            symbol={asset.symbol}
            name={asset.name}
            type={asset.type}
            currency={asset.currency}
          />
        ))}
      </div>
    </div>
  );
}
