"use client"
import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { TagChip } from "@/components/shared/tag-chip"
import { EmptyState } from "@/components/shared/empty-state"
import { cn, formatDate } from "@/lib/utils"
import { Search, BookOpen, Pin } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Note, NoteTag, Tag } from "@prisma/client"

type NoteWithTags = Note & { noteTags: (NoteTag & { tag: Tag })[] }

export function NoteList({ notes, tags }: { notes: NoteWithTags[]; tags: Tag[] }) {
  const t = useT()
  const [search, setSearch] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const filtered = notes.filter((note) => {
    if (search && !note.title.toLowerCase().includes(search.toLowerCase()) && !note.summary.toLowerCase().includes(search.toLowerCase())) return false
    if (activeTag && !note.noteTags.some((nt) => nt.tagId === activeTag)) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
          <Input placeholder={t.notes.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveTag(null)} className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", !activeTag ? "bg-[--primary] text-[--primary-foreground] border-[--primary]" : "border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] text-[--muted-foreground] hover:border-[var(--liquid-glass-border)] hover:bg-[var(--liquid-glass-hover-bg)]")}>
            {t.notes.filterAll}
          </button>
          {tags.map((tag) => (
            <button key={tag.id} onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}>
              <TagChip name={tag.name} color={tag.color} className={cn("cursor-pointer", activeTag && activeTag !== tag.id ? "opacity-40" : "")} />
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="group block p-4 rounded-xl glass-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium line-clamp-2 group-hover:text-[--primary] group-active:text-[--primary] transition-colors">{note.title}</h3>
                {note.isPinned && <Pin className="w-3.5 h-3.5 text-[--muted-foreground] flex-shrink-0 mt-0.5" />}
              </div>
              {note.summary && <p className="text-xs text-[--muted-foreground] line-clamp-2 mb-3">{note.summary}</p>}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {note.noteTags.slice(0, 2).map(({ tag }) => (
                    <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
                  ))}
                </div>
                <span className="text-xs text-[--muted-foreground] flex-shrink-0">{formatDate(note.updatedAt, "M月d日")}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen className="w-10 h-10" />}
          title={t.notes.emptyTitle}
          description={t.notes.emptyDesc}
        />
      )}
      <p className="text-xs text-[--muted-foreground]">{t.notes.count(filtered.length)}</p>
    </div>
  )
}
