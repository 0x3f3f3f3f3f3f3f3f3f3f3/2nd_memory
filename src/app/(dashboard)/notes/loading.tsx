import { Topbar } from "@/components/layout/topbar"
import { NoteSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <Topbar />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <NoteSkeleton />
      </div>
    </div>
  )
}
