import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Row 1: Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Row 2: Prospect Pipeline */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>

      {/* Row 3: Two-column */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>

      {/* Row 4: Pipeline Snapshot */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  )
}
