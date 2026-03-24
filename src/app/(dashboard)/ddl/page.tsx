import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { DdlPageView } from "@/components/timeline/ddl-page-view"
import { TaskFormButton } from "@/components/tasks/task-form-button"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "任务" }

export default async function DdlPage() {
  const { t } = await getServerT()
  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: { userId: OWNER_USER_ID, status: { notIn: ["ARCHIVED"] } },
      include: { taskTags: { include: { tag: true } }, subTasks: true, timeBlocks: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar title={t.tasks.pageTitle} actions={<TaskFormButton tags={tags} />} />
      <div className="flex-1 p-4 md:p-6 overflow-x-auto">
        <DdlPageView tasks={tasks} allTags={tags} />
      </div>
    </div>
  )
}
