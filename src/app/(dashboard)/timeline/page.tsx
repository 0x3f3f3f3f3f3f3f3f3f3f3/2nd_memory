import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TimelineView } from "@/components/timeline/timeline-view"

export const metadata = { title: "时间线" }

export default async function TimelinePage() {
  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: { userId: OWNER_USER_ID, dueAt: { not: null }, status: { notIn: ["ARCHIVED"] } },
      include: { taskTags: { include: { tag: true } }, subTasks: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar title="时间线" />
      <div className="flex-1 p-4 md:p-6 overflow-x-auto">
        <TimelineView tasks={tasks} allTags={tags} />
      </div>
    </div>
  )
}
