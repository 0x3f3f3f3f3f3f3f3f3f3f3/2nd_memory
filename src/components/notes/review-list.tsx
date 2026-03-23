"use client"
import { useState, useTransition } from "react"
import { reviewNote } from "@/lib/actions/notes"
import { Button } from "@/components/ui/button"
import { TagChip } from "@/components/shared/tag-chip"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { formatRelative, NOTE_TYPE_LABELS } from "@/lib/utils"
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Note, NoteTag, Tag, ReviewLog } from "@prisma/client"

type NoteWithRelations = Note & {
  noteTags: (NoteTag & { tag: Tag })[]
  reviewLogs: ReviewLog[]
}

const REVIEW_BUTTONS = [
  { value: "FORGOT", label: "忘了", cls: "border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" },
  { value: "VAGUE", label: "模糊", cls: "border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20" },
  { value: "REMEMBERED", label: "记得", cls: "border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20" },
  { value: "EASY", label: "很熟", cls: "border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20" },
]

function ReviewCard({ note }: { note: NoteWithRelations }) {
  const [expanded, setExpanded] = useState(false)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleRate = (rating: string) => {
    startTransition(async () => {
      await reviewNote(note.id, rating as any)
      setDone(true)
    })
  }

  if (done) return null

  return (
    <div className="border border-[--border] rounded-xl bg-[--card] overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{note.title}</h3>
            {note.summary && <p className="text-xs text-[--muted-foreground] mt-0.5">{note.summary}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">{NOTE_TYPE_LABELS[note.type]}</Badge>
            {note.lastReviewedAt && (
              <span className="text-xs text-[--muted-foreground]">{formatRelative(note.lastReviewedAt)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {note.noteTags.map(({ tag }) => <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />)}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-[--primary] hover:underline"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "收起" : "展开全文"}
        </button>
      </div>

      {expanded && note.contentMd && (
        <div className="px-4 pb-4 border-t border-[--border] pt-3 prose prose-sm max-w-none text-[--foreground]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.contentMd}</ReactMarkdown>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 bg-[--muted]/30 border-t border-[--border] flex-wrap">
        <span className="text-xs text-[--muted-foreground] mr-1">你记得吗?</span>
        {REVIEW_BUTTONS.map((btn) => (
          <Button key={btn.value} variant="outline" size="sm" className={`h-7 text-xs ${btn.cls}`} onClick={() => handleRate(btn.value)} disabled={isPending}>
            {btn.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function ReviewList({ notes }: { notes: NoteWithRelations[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<RotateCcw className="w-10 h-10" />}
        title="今日复习完成！"
        description="太棒了，所有知识已复习。明天继续保持。"
      />
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-[--muted-foreground]">共 {notes.length} 条待复习，逐一评分后进入下一条</p>
      {notes.map((note) => <ReviewCard key={note.id} note={note} />)}
    </div>
  )
}
