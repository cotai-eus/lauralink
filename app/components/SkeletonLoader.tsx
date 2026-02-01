export function FileSkeleton() {
  return (
    <div className="animate-pulse bg-gray-700/50 rounded-xl p-6 backdrop-blur">
      <div className="h-6 bg-gray-600 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-600 rounded w-1/4"></div>
    </div>
  );
}

export function FileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <FileSkeleton key={i} />
      ))}
    </div>
  );
}
