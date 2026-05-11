// Primitive shimmer block — compose these to match real content shapes
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-neutral-100 rounded-lg animate-pulse ${className}`} />
  )
}

// Pre-built skeletons for each dashboard page

export function CardRowSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-10 w-14 rounded-xl" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

export function WatchlistCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-12 w-14 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

export function MonitorCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-10 w-14 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function ComparePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-16 w-20 rounded-2xl" />
          <div className="flex-1 space-y-2 flex flex-col items-end">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-16 w-20 rounded-2xl" />
        </div>
      </div>
      {/* Complaint rows */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}
