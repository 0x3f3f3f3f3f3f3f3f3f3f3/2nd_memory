import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TaskItem } from "@/components/tasks/task-item"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cookies } from "next/headers"
import { getT } from "@/lib/i18n"
import { LOCALE_COOKIE, isLocale } from "@/lib/preferences"

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const userId = await getCurrentUserId()
  const cookieStore = await cookies()
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value
  const t = getT(isLocale(localeValue) ? localeValue : "zh")
  const tag = await prisma.tag.findUnique({
    where: { userId_slug: { userId: userId, slug } },
    include: {
      taskTags: {
        include: {
          task: { include: { taskTags: { include: { tag: true } }, subTasks: true } },
        },
      },
      noteTags: { include: { note: { include: { noteTags: { include: { tag: true } } } } } },
    },
  })
  if (!tag) notFound()

  const tasks = tag.taskTags.map((tt) => tt.task).filter((t) => t.status !== "ARCHIVED")
  const notes = tag.noteTags.map((nt) => nt.note).filter((n) => !n.archivedAt)

  return (
    <div className="flex flex-col">
      <Topbar
        title={tag.name}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tags"><ArrowLeft className="w-4 h-4" />{t.nav.tags}</Link>
          </Button>
        }
      />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
          <span className="text-lg font-bold">{tag.name}</span>
          {tag.description && <span className="text-sm text-[--muted-foreground]">{tag.description}</span>}
        </div>
        <div className="flex gap-4 text-sm text-[--muted-foreground]">
          <span>{t.tagsPage.tasksCount(tasks.length)}</span>
          <span>{t.tagsPage.notesCount(notes.length)}</span>
        </div>

        {tasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">{t.nav.tasks}</h2>
            <div className="space-y-2">
              {tasks.map((task) => <TaskItem key={task.id} task={task} />)}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">{t.nav.notes}</h2>
            <div className="space-y-2">
              {notes.map((note) => (
                <Link key={note.id} href={`/notes/${note.id}`} className="block p-3 rounded-xl bg-[var(--liquid-glass-bg)] border border-[var(--liquid-glass-border)] backdrop-blur-md hover:bg-[var(--liquid-glass-hover-bg)] transition-colors shadow-[var(--liquid-glass-shadow-soft)]">
                  <p className="text-sm font-medium">{note.title}</p>
                  {note.summary && <p className="text-xs text-[--muted-foreground] mt-0.5">{note.summary}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
