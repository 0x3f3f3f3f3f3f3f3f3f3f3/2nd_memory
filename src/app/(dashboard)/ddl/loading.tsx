import { Topbar } from "@/components/layout/topbar"
import { DdlSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col">
      <Topbar title="DDL" />
      <div className="flex-1 p-4 md:p-6">
        <DdlSkeleton />
      </div>
    </div>
  )
}
