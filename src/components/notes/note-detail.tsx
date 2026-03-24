"use client"
import { TagChip } from "@/components/shared/tag-chip"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatRelative } from "@/lib/utils"
import { Calendar, Clock } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Note, NoteTag, Tag as TagType, NoteTask, Task } from "@prisma/client"
import { useT } from "@/contexts/locale-context"

type NoteWithRelations = Note & {
  noteTags: (NoteTag & { tag: TagType })[]
  noteTasks: (NoteTask & { task: Task })[]
}

export function NoteDetail({ note, tags }: { note: NoteWithRelations; tags: TagType[] }) {
  const t = useT()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{t.noteTypes[note.type as keyof typeof t.noteTypes]}</Badge>
          {note.importance !== "MEDIUM" && (
            <Badge variant={note.importance === "HIGH" ? "default" : "outline"}>
              {t.noteImportance[note.importance as keyof typeof t.noteImportance]}
            </Badge>
          )}
        </div>
        <h1 className="text-xl font-bold">{note.title}</h1>
        {note.summary && (
          <p className="text-[--muted-foreground] italic border-l-2 border-[--primary] pl-3">
            {note.summary}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {note.noteTags.map(({ tag }) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
        <div className="flex gap-4 text-xs text-[--muted-foreground]">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t.taskDetail.createdAt(formatDate(note.createdAt, "yyyy-MM-dd"))}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.taskDetail.updatedAt(formatRelative(note.updatedAt))}</span>
        </div>
      </div>

      {/* Content */}
      {note.contentMd && (
        <div className="prose prose-sm max-w-none text-[--foreground]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.contentMd}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
