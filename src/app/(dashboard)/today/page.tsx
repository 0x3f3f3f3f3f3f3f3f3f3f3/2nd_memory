import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TaskItem } from "@/components/tasks/task-item"
import { QuickAdd } from "@/components/shared/quick-add"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { addDays } from "date-fns"
import { CheckSquare, AlertCircle, Clock, BookOpen } from "lucide-react"
import { getServerT } from "@/lib/server-locale"

/** Get start of day in China timezone (UTC+8), returned as UTC Date for Prisma queries */
function chinaDayStart(date: Date): Date {
  const chinaMs = date.getTime() + 8 * 3600000
  const chinaDate = new Date(chinaMs)
  const midnight = new Date(chinaDate.getFullYear(), chinaDate.getMonth(), chinaDate.getDate())
  return new Date(midnight.getTime() - 8 * 3600000)
}

export const metadata = { title: "今天" }

export default async function TodayPage() {
  const { t, locale } = await getServerT()
  const now = new Date()
  const todayStart = chinaDayStart(now)
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const weekEnd = new Date(todayStart.getTime() + 8 * 86400000)

  const [todayTasks, overdueTasks, upcomingTasks, reviewNotes] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: OWNER_USER_ID,
        dueAt: { gte: todayStart, lte: todayEnd },
        status: { not: "ARCHIVED" },
      },
      include: { taskTags: { include: { tag: true } }, subTasks: true },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        userId: OWNER_USER_ID,
        dueAt: { lt: todayStart },
        status: { notIn: ["DONE", "ARCHIVED"] },
      },
      include: { taskTags: { include: { tag: true } }, subTasks: true },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        userId: OWNER_USER_ID,
        dueAt: { gt: todayEnd, lte: weekEnd },
        status: { notIn: ["DONE", "ARCHIVED"] },
      },
      include: { taskTags: { include: { tag: true } }, subTasks: true },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.note.findMany({
      where: {
        userId: OWNER_USER_ID,
        nextReviewAt: { lte: now },
        archivedAt: null,
      },
      include: { noteTags: { include: { tag: true } } },
      orderBy: { nextReviewAt: "asc" },
      take: 5,
    }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar
        title={t.today.pageTitle}
        subtitle={now.toLocaleDateString(t.dateLocale, { weekday: "long", month: "long", day: "numeric" })}
        actions={<QuickAdd />}
      />
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl w-full mx-auto">

        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-semibold text-red-500">{t.today.overdue}</h2>
              <Badge variant="destructive" className="text-xs px-1.5 py-0">{overdueTasks.length}</Badge>
            </div>
            <div className="space-y-2">
              {overdueTasks.map((task) => <TaskItem key={task.id} task={task} />)}
            </div>
          </section>
        )}

        {/* Today's tasks */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="w-4 h-4 text-[--primary]" />
            <h2 className="text-sm font-semibold">{t.today.todayTasks}</h2>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{todayTasks.length}</Badge>
          </div>
          {todayTasks.length > 0 ? (
            <div className="space-y-2">
              {todayTasks.map((task) => <TaskItem key={task.id} task={task} />)}
            </div>
          ) : (
            <EmptyState
              icon={<CheckSquare className="w-10 h-10" />}
              title={t.today.noTasksTitle}
              description={t.today.noTasksDesc}
            />
          )}
        </section>

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[--muted-foreground]" />
              <h2 className="text-sm font-semibold">{t.today.upcoming}</h2>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{upcomingTasks.length}</Badge>
            </div>
            <div className="space-y-2">
              {upcomingTasks.map((task) => <TaskItem key={task.id} task={task} />)}
            </div>
          </section>
        )}

        {/* Review notes */}
        {reviewNotes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold">{t.today.review}</h2>
              <Badge className="text-xs px-1.5 py-0 bg-violet-100 text-violet-700 border-0">
                {t.today.reviewBadge(reviewNotes.length)}
              </Badge>
            </div>
            <div className="space-y-2">
              {reviewNotes.map((note) => (
                <a
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block p-3 rounded-xl bg-white/45 dark:bg-white/[0.03] border border-white/50 dark:border-white/[0.06] backdrop-blur-md hover:bg-white/65 dark:hover:bg-white/[0.06] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.5)]"
                >
                  <p className="text-sm font-medium">{note.title}</p>
                  {note.summary && (
                    <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{note.summary}</p>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
