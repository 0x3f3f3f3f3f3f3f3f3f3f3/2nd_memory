import { Topbar } from "@/components/layout/topbar"
import { InboxSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col">
      <Topbar />
      <div className="flex-1 p-4 md:p-6">
        <InboxSkeleton />
      </div>
    </div>
  )
}
