"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { TaskItem } from "@/components/tasks/task-item"
import { TagChip } from "./tag-chip"
import { Search, BookOpen, Tag, CheckSquare } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag as TagType, SubTask, Note, NoteTag } from "@prisma/client"

type TaskWithRelations = Task & { taskTags: (TaskTag & { tag: TagType })[], subTasks: SubTask[] }
type NoteWithTags = Note & { noteTags: (NoteTag & { tag: TagType })[] }

export function SearchResults({ tasks, notes, tags, query }: { tasks: TaskWithRelations[], notes: NoteWithTags[], tags: TagType[], query: string }) {
  const router = useRouter()
  const t = useT()
  const [value, setValue] = useState(query)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/search?q=${encodeURIComponent(value)}`)
  }

  const total = tasks.length + notes.length + tags.length

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
          <Input
            placeholder={t.searchPage.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pl-9 h-11 text-base"
            autoFocus
          />
        </div>
      </form>

      {query && (
        <p className="text-sm text-[--muted-foreground]">
          {t.searchPage.results(query, total)}
        </p>
      )}

      {tasks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[--primary]" />
            <h2 className="text-sm font-semibold">{t.searchPage.tasksSection(tasks.length)}</h2>
          </div>
          {tasks.map((task) => <TaskItem key={task.id} task={task} />)}
        </section>
      )}

      {notes.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold">{t.searchPage.notesSection(notes.length)}</h2>
          </div>
          {notes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="block p-3 rounded-xl bg-[var(--liquid-glass-bg)] border border-[var(--liquid-glass-border)] backdrop-blur-md hover:bg-[var(--liquid-glass-hover-bg)] transition-colors shadow-[var(--liquid-glass-shadow-soft)]">
              <p className="text-sm font-medium">{note.title}</p>
              {note.summary && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{note.summary}</p>}
            </Link>
          ))}
        </section>
      )}

      {tags.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[--muted-foreground]" />
            <h2 className="text-sm font-semibold">{t.searchPage.tagsSection(tags.length)}</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tags.map((tag) => (
              <Link key={tag.id} href={`/tags/${tag.slug}`}>
                <TagChip name={tag.name} color={tag.color} className="cursor-pointer hover:opacity-80" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {query && total === 0 && (
        <div className="text-center py-12 text-[--muted-foreground]">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t.searchPage.noResults(query)}</p>
        </div>
      )}
    </div>
  )
}
