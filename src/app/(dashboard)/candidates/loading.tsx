import { Skeleton } from '@/components/ui/skeleton'

export default function CandidatesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-9 w-[180px]" />
      <div className="rounded-md border">
        <div className="space-y-0 divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
