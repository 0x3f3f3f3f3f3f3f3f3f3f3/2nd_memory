"use client"
import { useState, useTransition, useEffect } from "react"
import { updateTask, deleteTask } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { cn, isOverdue, PRIORITY_COLORS, formatDate, toLocalDatetimeInput } from "@/lib/utils"
import { X, Trash2, Loader2, AlertCircle, CalendarDays, CheckSquare, Tag as TagIcon, AlignLeft } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
}

interface TaskDetailPanelProps {
  task: TaskWithRelations
  allTags: Tag[]
  onClose: () => void
}

export function TaskDetailPanel({ task, allTags, onClose }: TaskDetailPanelProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState<string>(task.priority)
  const [status, setStatus] = useState<string>(task.status)
  const [dueAt, setDueAt] = useState(() => toLocalDatetimeInput(task.dueAt))
  const [selectedTags, setSelectedTags] = useState(task.taskTags.map(tt => tt.tagId))

  // Reset form when a different task is selected
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? "")
    setPriority(task.priority)
    setStatus(task.status)
    setDueAt(toLocalDatetimeInput(task.dueAt))
    setSelectedTags(task.taskTags.map(tt => tt.tagId))
    setConfirmDelete(false)
    setSaved(false)
  }, [task.id])

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
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTask(task.id)
      onClose()
    })
  }

  const overdue = task.status !== "DONE" && isOverdue(task.dueAt)

  return (
    <div className={cn(
      "glass-flat-panel panel-flat-surface flex flex-col h-full rounded-3xl overflow-hidden",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--liquid-glass-border-soft)] flex-shrink-0">
        <span className="text-sm font-semibold text-[--foreground]/80">{t.taskDetail.editTitle}</span>
        <div className="flex items-center gap-1">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-[--muted-foreground] hover:text-[--destructive] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title={t.taskDetail.deleteBtn}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={isPending} onClick={handleDelete}>
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t.taskDetail.confirmDeleteBtn}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                {t.taskDetail.cancelBtn}
              </Button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[--muted-foreground] hover:text-[--foreground] hover:bg-[var(--liquid-glass-bg-soft)] transition-colors"
            title={t.taskDetail.cancelBtn}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Title */}
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm font-medium border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]"
          placeholder={t.tasks.titlePlaceholder}
        />

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-[--muted-foreground]">{t.taskDetail.statusLabel}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[--muted-foreground]">{t.taskDetail.priorityLabel}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Due date */}
        <div className="space-y-1">
          <Label className={cn("text-xs flex items-center gap-1", overdue ? "text-red-500" : "text-[--muted-foreground]")}>
            {overdue ? <AlertCircle className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
            {t.taskDetail.dueDateLabel}
          </Label>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={e => setDueAt(e.target.value)}
            className="h-8 text-xs border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
            <AlignLeft className="w-3 h-3" />{t.taskDetail.notesLabel}
          </Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder={t.taskDetail.notesPlaceholder}
            className="text-sm border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)] resize-none"
          />
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
              <TagIcon className="w-3 h-3" />{t.taskDetail.tagsLabel}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTags(prev =>
                    prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                  )}
                >
                  <TagChip
                    name={tag.name}
                    color={tag.color}
                    size="sm"
                    className={cn("cursor-pointer transition-opacity",
                      selectedTags.includes(tag.id) ? "ring-2 ring-offset-1" : "opacity-40 hover:opacity-70"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subtasks (read-only) */}
        {task.subTasks.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              {t.taskDetail.subtasksLabel(task.subTasks.filter(s => s.done).length, task.subTasks.length)}
            </Label>
            <div className="space-y-1">
              {task.subTasks.map(sub => (
                <div
                  key={sub.id}
                  className={cn(
                    "flex items-center gap-2 text-xs px-2 py-1 rounded-lg border border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg-soft)]",
                    sub.done && "opacity-50"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded border flex items-center justify-center flex-shrink-0", sub.done ? "bg-[--primary] border-[--primary] text-[--primary-foreground]" : "border-[--border]")}>
                    {sub.done && <span className="text-[8px]">✓</span>}
                  </div>
                  <span className={cn(sub.done && "line-through text-[--muted-foreground]")}>{sub.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-[--muted-foreground]/50">
          {t.taskDetail.createdAt(formatDate(task.createdAt))}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--liquid-glass-border-soft)] flex-shrink-0">
        <Button
          className="w-full h-8 text-sm"
          disabled={isPending || !title.trim()}
          onClick={handleSave}
        >
          {isPending
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : saved
            ? "✓ "
            : null}
          {saved ? "已保存" : t.taskDetail.saveBtn}
        </Button>
      </div>
    </div>
  )
}
