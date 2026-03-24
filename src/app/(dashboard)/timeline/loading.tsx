import { Topbar } from "@/components/layout/topbar"
import { TimelineSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col">
      <Topbar title="规划" />
      <div className="flex-1 p-4 md:p-6">
        <TimelineSkeleton />
      </div>
    </div>
  )
}
