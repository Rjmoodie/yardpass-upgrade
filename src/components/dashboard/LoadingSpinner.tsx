import { LoadingSpinner as BrandedLoadingSpinner } from '@/components/LoadingSpinner';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <BrandedLoadingSpinner
        size="md"
        label="Loading your dashboard…"
        helperText="Syncing metrics, payouts, and live event updates"
      />
    </div>
  );
}