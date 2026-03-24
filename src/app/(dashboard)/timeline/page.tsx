import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TimelineView } from "@/components/timeline/timeline-view"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "规划" }

export default async function TimelinePage() {
  const { t } = await getServerT()
  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: { userId: OWNER_USER_ID, status: { notIn: ["ARCHIVED"] } },
      include: { taskTags: { include: { tag: true } }, subTasks: true, timeBlocks: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar title={t.timeline.pageTitle} />
      <div className="flex-1 p-4 md:p-6 overflow-x-auto">
        <TimelineView tasks={tasks} allTags={tags} />
      </div>
    </div>
  )
}
