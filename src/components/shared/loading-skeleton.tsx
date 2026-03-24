import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer", className)}
      {...props}
    />
  )
}

const GLASS = "bg-white/45 dark:bg-white/[0.03] border border-white/50 dark:border-white/[0.06] backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)]"

export function TaskSkeleton() {
  return (
    <div className="space-y-3 max-w-3xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-3 p-3 rounded-xl", GLASS)}>
          <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function NoteSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn("p-4 rounded-xl space-y-3", GLASS)}>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InboxSkeleton() {
  return (
    <div className="space-y-3 max-w-3xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn("flex items-start gap-3 p-4 rounded-xl", GLASS)}>
          <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn("p-4 rounded-xl space-y-3", GLASS)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex gap-2 pt-1 border-t border-white/30 dark:border-white/[0.05]">
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-32 ml-1" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Task panel strip */}
      <div className={cn("px-3 py-2.5 rounded-2xl", GLASS)}>
        <Skeleton className="h-3 w-40 mb-2" />
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Week grid */}
      <div className={cn("rounded-3xl overflow-hidden", GLASS)}>
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-white/30 dark:border-white/[0.06]">
          <div className="w-12" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2.5 flex flex-col items-center gap-1">
              <Skeleton className="h-2.5 w-6" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
        {/* Body rows */}
        <div className="p-2 space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-1 py-2 border-b border-white/20 dark:border-white/[0.03] last:border-0">
              <div className="w-12 flex justify-end pr-2">
                <Skeleton className="h-2.5 w-6" />
              </div>
              <div className="flex-1 flex gap-1">
                {i === 1 && <Skeleton className="h-12 w-full rounded-xl" />}
                {i === 3 && <Skeleton className="h-8 w-full rounded-xl" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DdlSkeleton() {
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn("rounded-2xl overflow-hidden", GLASS)}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/30 dark:border-white/[0.05]">
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="divide-y divide-white/20 dark:divide-white/[0.04]">
            {Array.from({ length: i + 1 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-2 w-2 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-8 flex-shrink-0" />
                <Skeleton className="h-1.5 w-20 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton }
