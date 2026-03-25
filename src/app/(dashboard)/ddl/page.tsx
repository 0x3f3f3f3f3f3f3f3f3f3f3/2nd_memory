import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { DdlPageView } from "@/components/timeline/ddl-page-view"
import { TaskFormButton } from "@/components/tasks/task-form-button"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "任务" }

export default async function DdlPage() {
  const userId = await getCurrentUserId()
  const { t } = await getServerT()
  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: { userId: userId, status: { notIn: ["ARCHIVED"] } },
      include: { taskTags: { include: { tag: true } }, subTasks: true, timeBlocks: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tag.findMany({ where: { userId: userId }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar actions={<div className="hidden md:block"><TaskFormButton tags={tags} /></div>} />
      <div className="flex-1 p-4 md:p-6 overflow-x-hidden">
        <DdlPageView tasks={tasks} allTags={tags} />
        <TaskFormButton
          tags={tags}
          labelMode="always"
          buttonClassName="md:hidden fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full px-5 shadow-lg"
        />
      </div>
    </div>
  )
}
