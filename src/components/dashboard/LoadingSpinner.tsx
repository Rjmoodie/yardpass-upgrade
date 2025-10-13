import { YardpassSpinner } from '@/components/LoadingSpinner';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <YardpassSpinner size="md" />
    </div>
  );
}