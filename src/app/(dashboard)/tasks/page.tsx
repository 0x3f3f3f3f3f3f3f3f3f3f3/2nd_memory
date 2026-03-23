import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TaskList } from "@/components/tasks/task-list"
import { TaskFormButton } from "@/components/tasks/task-form-button"

export const metadata = { title: "任务" }

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; tag?: string; q?: string }>
}) {
  const params = await searchParams
  const { status, priority, tag, q } = params

  const [tasks, tags] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: OWNER_USER_ID,
        ...(status ? { status: status as any } : { status: { not: "ARCHIVED" } }),
        ...(priority ? { priority: priority as any } : {}),
        ...(tag ? { taskTags: { some: { tag: { slug: tag } } } } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { taskTags: { include: { tag: true } }, subTasks: true },
      orderBy: [{ isPinned: "desc" }, { priority: "desc" }, { dueAt: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar title="任务" actions={<TaskFormButton tags={tags} />} />
      <div className="flex-1 p-4 md:p-6">
        <TaskList tasks={tasks} tags={tags} />
      </div>
    </div>
  )
}
