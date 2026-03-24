import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { DdlPageView } from "@/components/timeline/ddl-page-view"

export const metadata = { title: "DDL 时间线" }

export default async function DdlPage() {
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
      <Topbar title="DDL 时间线" />
      <div className="flex-1 p-4 md:p-6 overflow-x-auto">
        <DdlPageView tasks={tasks} allTags={tags} />
      </div>
    </div>
  )
}
