import { Suspense } from 'react';
import { ScannerView } from '@/components/scanner/ScannerView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ScannerPageProps {
  eventId: string;
  onBack: () => void;
}

function ScannerFallback() {
  return (
    <Card className="mx-auto mt-10 w-full max-w-4xl border-border/60 bg-background/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Loading scanner…</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function ScannerPage({ eventId, onBack }: ScannerPageProps) {
  return (
    <Suspense fallback={<ScannerFallback />}>
      <ScannerView eventId={eventId} onBack={onBack} />
    </Suspense>
  );
}

export default ScannerPage;

