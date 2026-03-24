"use client"
import { useState, useTransition, useEffect } from "react"
import { updateTask, deleteTask } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { cn, getDueLabel, isOverdue, PRIORITY_COLORS, formatDate, toLocalDatetimeInput } from "@/lib/utils"
import {
  Pencil, Trash2, Loader2, Clock, AlertCircle, CalendarDays,
  AlignLeft, Tag as TagIcon, CheckSquare, X,
} from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { TaskWithRelations } from "./task-item"
import type { Tag } from "@prisma/client"

const STATUS_BADGE_COLOR: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  DOING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
}

interface Props {
  task: TaskWithRelations | null
  allTags: Tag[]
  onClose: () => void
}

export function TaskDetailSidebar({ task, allTags, onClose }: Props) {
  const t = useT()
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [status, setStatus] = useState("TODO")
  const [dueAt, setDueAt] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Sync form state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? "")
      setPriority(task.priority)
      setStatus(task.status)
      setDueAt(toLocalDatetimeInput(task.dueAt))
      setSelectedTags(task.taskTags.map((tt) => tt.tagId))
      setMode("view")
      setConfirmDelete(false)
    }
  }, [task?.id])

  if (!task) return null

  const overdue = task.status !== "DONE" && isOverdue(task.dueAt)
  const dueLabel = getDueLabel(task.dueAt, undefined, { suppressOverdue: task.status === "DONE" })

  const PRIORITY_OPTIONS = [
    { value: "LOW", label: t.tasks.priorityLow },
    { value: "MEDIUM", label: t.tasks.priorityMedium },
    { value: "HIGH", label: t.tasks.priorityHigh },
    { value: "URGENT", label: t.tasks.priorityUrgent },
  ]
  const STATUS_OPTIONS = [
    { value: "TODO", label: t.tasks.statusTodo },
    { value: "DOING", label: t.tasks.statusDoing },
    { value: "DONE", label: t.tasks.statusDone },
  ]
  const PRIORITY_LABELS: Record<string, string> = {
    LOW: t.tasks.priorityLow, MEDIUM: t.tasks.priorityMedium,
    HIGH: t.tasks.priorityHigh, URGENT: t.tasks.priorityUrgent,
  }
  const STATUS_LABELS: Record<string, string> = {
    TODO: t.tasks.statusTodo, DOING: t.tasks.statusDoing, DONE: t.tasks.statusDone,
  }

  const handleSave = () => {
    startTransition(async () => {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority as any,
        status: status as any,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        tagIds: selectedTags,
      })
      setMode("view")
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTask(task.id)
      onClose()
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-[min(480px,100vw)] z-50",
        "flex flex-col",
        "bg-white/80 dark:bg-[#252220]/90",
        "backdrop-blur-2xl saturate-150",
        "border-l border-[var(--liquid-glass-border)]",
        "shadow-[-8px_0_32px_rgba(0,0,0,0.08)] dark:shadow-[-8px_0_32px_rgba(0,0,0,0.3)]",
        "animate-slide-in-right",
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--liquid-glass-border-soft)] flex-shrink-0">
          <h2 className="text-sm font-semibold">
            {mode === "edit" ? t.taskDetail.editTitle : t.taskDetail.viewTitle}
          </h2>
          <div className="flex items-center gap-1">
            {mode === "view" && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setMode("edit")}>
                <Pencil className="w-3.5 h-3.5 mr-1" />{t.taskDetail.editBtn}
              </Button>
            )}
            {!confirmDelete ? (
              <Button
                size="sm" variant="ghost"
                className="h-8 px-2 text-xs text-[--destructive] hover:text-[--destructive] hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />{t.taskDetail.deleteBtn}
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="destructive" className="h-8 px-2 text-xs" disabled={isPending} onClick={handleDelete}>
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.taskDetail.confirmDeleteBtn}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                  {t.taskDetail.cancelBtn}
                </Button>
              </div>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "view" ? (
            <div className="space-y-4">
              <p className={cn("text-base font-medium", task.status === "DONE" && "line-through text-[--muted-foreground]")}>
                {task.title}
              </p>

              <div className="flex flex-wrap gap-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGE_COLOR[task.status] ?? STATUS_BADGE_COLOR.TODO)}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full bg-[--muted] font-medium", PRIORITY_COLORS[task.priority])}>
                  {t.taskDetail.priorityValue(PRIORITY_LABELS[task.priority] ?? task.priority)}
                </span>
                {dueLabel && (
                  <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", overdue ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-[--muted] text-[--muted-foreground]")}>
                    {overdue ? <AlertCircle className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
                    {dueLabel}
                  </span>
                )}
              </div>

              {task.description && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                    <AlignLeft className="w-3.5 h-3.5" />{t.taskDetail.notesLabel}
                  </p>
                  <p className="text-sm text-[--foreground] bg-[--muted]/50 rounded-lg p-3 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {task.taskTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                    <TagIcon className="w-3.5 h-3.5" />{t.taskDetail.tagsLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {task.taskTags.map(({ tag }) => (
                      <TagChip key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                  </div>
                </div>
              )}

              {task.subTasks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5" />{t.taskDetail.subtasksLabel(task.subTasks.filter(s => s.done).length, task.subTasks.length)}
                  </p>
                  <div className="space-y-1">
                    {task.subTasks.map((sub) => (
                      <div key={sub.id} className={cn("flex items-center gap-2 text-sm", sub.done && "opacity-50")}>
                        <div className={cn("w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[10px]", sub.done ? "bg-[--primary] border-[--primary] text-[--primary-foreground]" : "border-[--border]")}>
                          {sub.done && "✓"}
                        </div>
                        <span className={cn(sub.done && "line-through text-[--muted-foreground]")}>{sub.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-[--muted-foreground]">
                {t.taskDetail.createdAt(formatDate(task.createdAt))}
                {task.updatedAt !== task.createdAt && t.taskDetail.updatedAt(formatDate(task.updatedAt))}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t.tasks.titleLabel}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>{t.taskDetail.notesLabel}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t.taskDetail.notesPlaceholder} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.taskDetail.statusLabel}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.taskDetail.priorityLabel}</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t.taskDetail.dueDateLabel}</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              {allTags.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t.taskDetail.tagsLabel}</Label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setSelectedTags((prev) =>
                          prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )}
                      >
                        <TagChip
                          name={tag.name}
                          color={tag.color}
                          className={cn("cursor-pointer transition-opacity", selectedTags.includes(tag.id) ? "ring-2 ring-offset-1" : "opacity-50 hover:opacity-80")}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setMode("view")}>{t.taskDetail.cancelBtn}</Button>
                <Button type="button" disabled={isPending || !title.trim()} onClick={handleSave}>
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.taskDetail.saveBtn}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
