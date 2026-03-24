"use client"
import { useTransition } from "react"
import { reviewNote } from "@/lib/actions/notes"
import { TagChip } from "@/components/shared/tag-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatRelative } from "@/lib/utils"
import { Calendar, Clock, RefreshCw } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Note, NoteTag, Tag as TagType, ReviewLog, NoteTask, Task } from "@prisma/client"
import { useT } from "@/contexts/locale-context"

type NoteWithRelations = Note & {
  noteTags: (NoteTag & { tag: TagType })[]
  reviewLogs: ReviewLog[]
  noteTasks: (NoteTask & { task: Task })[]
}

const REVIEW_BUTTON_STYLES = [
  { value: "FORGOT", className: "border-red-300 text-red-600 hover:bg-red-50" },
  { value: "VAGUE", className: "border-orange-300 text-orange-600 hover:bg-orange-50" },
  { value: "REMEMBERED", className: "border-blue-300 text-blue-600 hover:bg-blue-50" },
  { value: "EASY", className: "border-green-300 text-green-600 hover:bg-green-50" },
]

export function NoteDetail({ note, tags }: { note: NoteWithRelations; tags: TagType[] }) {
  const [isPending, startTransition] = useTransition()
  const t = useT()

  const handleReview = (rating: "FORGOT" | "VAGUE" | "REMEMBERED" | "EASY") => {
    startTransition(async () => {
      await reviewNote(note.id, rating)
    })
  }

  const reviewLabels: Record<string, string> = {
    FORGOT: t.review.btnForgot,
    VAGUE: t.review.btnVague,
    REMEMBERED: t.review.btnRemembered,
    EASY: t.review.btnEasy,
  }

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

      {/* Review */}
      <div className="border border-white/50 dark:border-white/[0.08] rounded-xl p-4 bg-white/40 dark:bg-white/[0.03] backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium">{t.review.sectionTitle}</span>
          {note.nextReviewAt && (
            <span className="text-xs text-[--muted-foreground]">
              {t.review.nextReview(formatRelative(note.nextReviewAt))}
            </span>
          )}
          {note.lastReviewedAt && (
            <span className="text-xs text-[--muted-foreground]">
              {t.review.lastReview(formatRelative(note.lastReviewedAt))}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {REVIEW_BUTTON_STYLES.map((btn) => (
            <Button
              key={btn.value}
              variant="outline"
              size="sm"
              className={btn.className}
              onClick={() => handleReview(btn.value as any)}
              disabled={isPending}
            >
              {reviewLabels[btn.value]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
