"use client"
import { useTransition } from "react"
import { reviewNote } from "@/lib/actions/notes"
import { TagChip } from "@/components/shared/tag-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NOTE_TYPE_LABELS, formatDate, formatRelative } from "@/lib/utils"
import { Calendar, Clock, RefreshCw, Tag } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Note, NoteTag, Tag as TagType, ReviewLog, NoteTask, Task } from "@prisma/client"

type NoteWithRelations = Note & {
  noteTags: (NoteTag & { tag: TagType })[]
  reviewLogs: ReviewLog[]
  noteTasks: (NoteTask & { task: Task })[]
}

const REVIEW_BUTTONS = [
  { value: "FORGOT", label: "忘了", className: "border-red-300 text-red-600 hover:bg-red-50" },
  { value: "VAGUE", label: "模糊", className: "border-orange-300 text-orange-600 hover:bg-orange-50" },
  { value: "REMEMBERED", label: "记得", className: "border-blue-300 text-blue-600 hover:bg-blue-50" },
  { value: "EASY", label: "很熟", className: "border-green-300 text-green-600 hover:bg-green-50" },
]

export function NoteDetail({ note, tags }: { note: NoteWithRelations; tags: TagType[] }) {
  const [isPending, startTransition] = useTransition()

  const handleReview = (rating: "FORGOT" | "VAGUE" | "REMEMBERED" | "EASY") => {
    startTransition(async () => {
      await reviewNote(note.id, rating)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{NOTE_TYPE_LABELS[note.type]}</Badge>
          {note.importance !== "MEDIUM" && (
            <Badge variant={note.importance === "HIGH" ? "default" : "outline"}>
              {note.importance === "HIGH" ? "重要" : "一般"}
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
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />创建于 {formatDate(note.createdAt, "yyyy年M月d日")}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />更新于 {formatRelative(note.updatedAt)}</span>
        </div>
      </div>

      {/* Content */}
      {note.contentMd && (
        <div className="prose prose-sm max-w-none text-[--foreground]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.contentMd}</ReactMarkdown>
        </div>
      )}

      {/* Review */}
      <div className="border border-[--border] rounded-xl p-4 bg-[--muted]/30 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium">复习</span>
          {note.nextReviewAt && (
            <span className="text-xs text-[--muted-foreground]">
              下次: {formatRelative(note.nextReviewAt)}
            </span>
          )}
          {note.lastReviewedAt && (
            <span className="text-xs text-[--muted-foreground]">
              · 上次: {formatRelative(note.lastReviewedAt)}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {REVIEW_BUTTONS.map((btn) => (
            <Button
              key={btn.value}
              variant="outline"
              size="sm"
              className={btn.className}
              onClick={() => handleReview(btn.value as any)}
              disabled={isPending}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
