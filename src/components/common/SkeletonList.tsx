export default function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}

