import { Topbar } from "@/components/layout/topbar"
import { Skeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col h-screen">
      <Topbar title="AI 助手" />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Skeleton className="w-16 h-16 rounded-3xl mb-4" />
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  )
}
