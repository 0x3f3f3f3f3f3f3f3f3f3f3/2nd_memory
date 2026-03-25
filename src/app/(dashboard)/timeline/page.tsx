import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TimelineView } from "@/components/timeline/timeline-view"

export const metadata = { title: "规划" }

export default async function TimelinePage() {
  const userId = await getCurrentUserId()
  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: { userId: userId, status: { notIn: ["ARCHIVED"] } },
      include: { taskTags: { include: { tag: true } }, subTasks: true, timeBlocks: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.tag.findMany({ where: { userId: userId }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar />
      <div className="flex-1 p-4 md:p-6 overflow-x-hidden">
        <TimelineView tasks={tasks} allTags={tags} />
      </div>
    </div>
  )
}
