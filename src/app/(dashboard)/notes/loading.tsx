import { Topbar } from "@/components/layout/topbar"
import { NoteSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col">
      <Topbar />
      <div className="flex-1 p-4 md:p-6">
        <NoteSkeleton />
      </div>
    </div>
  )
}
