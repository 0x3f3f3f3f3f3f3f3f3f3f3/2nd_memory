"use client"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { createAllDayBlock, createTimeBlock, deleteTimeBlock, updateTask, deleteTask, updateTimeBlock } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { cn, isOverdue, PRIORITY_COLORS, formatDate, toLocalDatetimeInput } from "@/lib/utils"
import { X, Trash2, Loader2, AlertCircle, CalendarDays, CheckSquare, Tag as TagIcon, AlignLeft, Clock, Pencil } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"
import { TaskSubtasks } from "./task-subtasks"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
  timeBlocks?: TimeBlock[]
}

interface TaskDetailPanelProps {
  task: TaskWithRelations
  allTags: Tag[]
  initialMode?: "view" | "edit"
  initialEditingBlockId?: string | null
  onClose: () => void
}

function pad(v: number) {
  return String(v).padStart(2, "0")
}

function toDateInput(date: Date | string) {
  const value = new Date(date)
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function toTimeInput(date: Date | string) {
  const value = new Date(date)
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function buildLocalDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function getDefaultScheduleFields() {
  const start = new Date()
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return {
    date: toDateInput(start),
    start: toTimeInput(start),
    end: toTimeInput(end),
  }
}

export function TaskDetailPanel({ task, allTags, initialMode = "view", initialEditingBlockId = null, onClose }: TaskDetailPanelProps) {
  const t = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSchedulePending, startScheduleTransition] = useTransition()
  const [mode, setMode] = useState<"view" | "edit">(initialMode)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState<string>(task.priority)
  const [status, setStatus] = useState<string>(task.status)
  const [dueAt, setDueAt] = useState(() => toLocalDatetimeInput(task.dueAt))
  const [selectedTags, setSelectedTags] = useState(task.taskTags.map(tt => tt.tagId))
  const defaults = getDefaultScheduleFields()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [scheduleSubTaskId, setScheduleSubTaskId] = useState<string>("__main__")
  const [scheduleDate, setScheduleDate] = useState(defaults.date)
  const [scheduleStart, setScheduleStart] = useState(defaults.start)
  const [scheduleEnd, setScheduleEnd] = useState(defaults.end)
  const [scheduleError, setScheduleError] = useState("")
  const scheduledBlocks = [...(task.timeBlocks ?? [])]
    .filter((block) => !block.isAllDay)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  const selectedBlock = editingBlockId
    ? (task.timeBlocks ?? []).find((item) => item.id === editingBlockId) ?? null
    : null

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
    setMode(initialMode)
    setScheduleOpen(false)
    setEditingBlockId(null)
    setScheduleSubTaskId("__main__")
    setScheduleError("")
  }, [task.id, initialMode])

  useEffect(() => {
    if (!initialEditingBlockId) return
    const block = (task.timeBlocks ?? []).find((item) => item.id === initialEditingBlockId)
    if (!block) return
    setEditingBlockId(block.id)
    setScheduleSubTaskId(block.subTaskId ?? "__main__")
    if (initialMode === "edit") {
      setMode("edit")
      openScheduleEditor(block)
    }
  }, [initialEditingBlockId, task.id, initialMode])

  const handleDeploymentTargetChange = (value: string) => {
    if (!selectedBlock) return
    setScheduleSubTaskId(value)
    startScheduleTransition(async () => {
      const nextSubTaskId = value === "__main__" ? null : value
      await updateTimeBlock(
        selectedBlock.id,
        new Date(selectedBlock.startAt),
        new Date(selectedBlock.endAt),
        nextSubTaskId
      )
      const matchingAllDay = (task.timeBlocks ?? []).find(
        (item) => item.isAllDay && toDateInput(item.startAt) === toDateInput(selectedBlock.startAt)
      )
      if (matchingAllDay) {
        await updateTimeBlock(
          matchingAllDay.id,
          new Date(matchingAllDay.startAt),
          new Date(matchingAllDay.endAt),
          nextSubTaskId
        )
      } else {
        await createAllDayBlock(task.id, toDateInput(selectedBlock.startAt), nextSubTaskId ?? undefined)
      }
      router.refresh()
    })
  }

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

  const openScheduleEditor = (block?: TimeBlock) => {
    if (block) {
      setEditingBlockId(block.id)
      setScheduleDate(toDateInput(block.startAt))
      setScheduleStart(toTimeInput(block.startAt))
      setScheduleEnd(toTimeInput(block.endAt))
      setScheduleSubTaskId(block.subTaskId ?? "__main__")
    } else {
      const nextDefaults = getDefaultScheduleFields()
      setEditingBlockId(null)
      setScheduleDate(nextDefaults.date)
      setScheduleStart(nextDefaults.start)
      setScheduleEnd(nextDefaults.end)
      setScheduleSubTaskId("__main__")
    }
    setScheduleError("")
    setScheduleOpen(true)
  }

  const handleScheduleSave = () => {
    const startAt = buildLocalDate(scheduleDate, scheduleStart)
    const endAt = buildLocalDate(scheduleDate, scheduleEnd)
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setScheduleError(t.taskDetail.invalidScheduleValue)
      return
    }
    if (endAt <= startAt) {
      setScheduleError(t.taskDetail.invalidScheduleRange)
      return
    }

    startScheduleTransition(async () => {
      if (editingBlockId) {
        await updateTimeBlock(editingBlockId, startAt, endAt, scheduleSubTaskId === "__main__" ? null : scheduleSubTaskId)
      } else {
        await createTimeBlock(task.id, startAt, endAt)
      }
      setScheduleOpen(false)
      setEditingBlockId(null)
      setScheduleError("")
      router.refresh()
    })
  }

  const handleScheduleDelete = (id: string) => {
    startScheduleTransition(async () => {
      await deleteTimeBlock(id)
      router.refresh()
    })
  }

  const overdue = task.status !== "DONE" && isOverdue(task.dueAt)

  return (
    <div className={cn(
      "glass-flat-panel panel-flat-surface flex flex-col h-full max-h-full min-h-0 rounded-3xl overflow-hidden",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--liquid-glass-border-soft)] flex-shrink-0">
        <span className="text-sm font-semibold text-[--foreground]/80">{mode === "edit" ? t.taskDetail.editTitle : t.taskDetail.viewTitle}</span>
        <div className="flex items-center gap-1">
          {mode === "view" && (
            <button
              onClick={() => setMode("edit")}
              className="p-1.5 rounded-lg text-[--muted-foreground] hover:text-[--foreground] hover:bg-[var(--liquid-glass-bg-soft)] transition-colors"
              title={t.taskDetail.editBtn}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
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
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
        {mode === "view" ? (
          <div className="space-y-4">
            <div>
              <p className={cn("text-base font-medium", task.status === "DONE" && "line-through text-[--muted-foreground]")}>
                {task.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status === "DONE" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : status === "DOING" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
                {status}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full bg-[--muted] font-medium", PRIORITY_COLORS[priority])}>
                {priority}
              </span>
              {dueAt && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full", overdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-[var(--liquid-glass-chip-bg)] text-[--muted-foreground] border border-[var(--liquid-glass-border-soft)]")}>
                  {dueAt}
                </span>
              )}
            </div>

            {task.description && (
              <div className="space-y-1">
                <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
                  <AlignLeft className="w-3 h-3" />{t.taskDetail.notesLabel}
                </Label>
                <p className="text-sm text-[--foreground] bg-[--muted]/50 rounded-lg p-3 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {task.taskTags.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
                  <TagIcon className="w-3 h-3" />{t.taskDetail.tagsLabel}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {task.taskTags.map(({ tag }) => (
                    <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
                  ))}
                </div>
              </div>
            )}

            {selectedBlock && task.subTasks.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
                  <Clock className="w-3 h-3" />部署对象
                </Label>
                <Select value={scheduleSubTaskId} onValueChange={handleDeploymentTargetChange}>
                  <SelectTrigger className="h-8 text-xs border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__main__">{task.title}</SelectItem>
                    {task.subTasks.map((subTask) => (
                      <SelectItem key={subTask.id} value={subTask.id}>{subTask.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <TaskSubtasks taskId={task.id} initialSubTasks={task.subTasks} />
          </div>
        ) : (
          <>
        {/* Title */}
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-sm font-medium border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-input-bg)]"
          placeholder={t.tasks.titlePlaceholder}
        />

        {/* Status + Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-[--muted-foreground] flex items-center gap-1">
              <Clock className="w-3 h-3" />{t.taskDetail.scheduleTitle}
            </Label>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => openScheduleEditor()}>
              {t.taskDetail.addScheduleBtn}
            </Button>
          </div>
          {scheduledBlocks.length > 0 ? (
            <div className="space-y-2">
              {scheduledBlocks.map((block, index) => (
                <div
                  key={block.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border shadow-[var(--liquid-glass-shadow-soft)]",
                    index % 2 === 0
                      ? "border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)]"
                      : "border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg-soft)]"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-start gap-3 px-3 py-3",
                      index % 2 === 0 ? "bg-white/45 dark:bg-white/5" : "bg-[#C96444]/[0.04] dark:bg-white/5"
                    )}
                  >
                    <div className="w-16 flex-shrink-0 rounded-xl border border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg)] px-2 py-2 text-center shadow-[var(--liquid-glass-shadow-soft)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[--muted-foreground]">
                        {format(new Date(block.startAt), "EEE")}
                      </p>
                      <p className="mt-1 text-base font-semibold leading-none tabular-nums">
                        {format(new Date(block.startAt), "M/d")}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                      <p className="text-sm font-medium whitespace-nowrap tabular-nums leading-none">
                        {format(new Date(block.startAt), "h:mm a")} - {format(new Date(block.endAt), "h:mm a")}
                      </p>
                      {block.subTaskId && (
                        <p className="inline-flex max-w-full rounded-full border border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg)] px-2 py-1 text-[11px] text-[--muted-foreground] truncate shadow-[var(--liquid-glass-shadow-soft)]">
                          子任务 · {task.subTasks.find((subTask) => subTask.id === block.subTaskId)?.title ?? "Subtask"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 border-t border-[var(--liquid-glass-border-soft)] bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs whitespace-nowrap border border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg)] hover:bg-[var(--liquid-glass-hover-bg)]"
                      onClick={() => openScheduleEditor(block)}
                    >
                        {t.taskDetail.editScheduleBtn}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-[--destructive] whitespace-nowrap border border-red-200/70 bg-red-50/80 hover:bg-red-100/90 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-950/35"
                      onClick={() => handleScheduleDelete(block.id)}
                    >
                        {t.taskDetail.deleteScheduleBtn}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[--muted-foreground] rounded-xl border border-dashed border-[var(--liquid-glass-border-soft)] px-3 py-3">
              {t.taskDetail.noSchedule}
            </p>
          )}

          {scheduleOpen && (
            <div className="rounded-2xl border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg-soft)] p-3 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.taskDetail.dateField}</Label>
                  <Input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} />
                </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t.taskDetail.startField}</Label>
                    <Input type="time" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.taskDetail.endField}</Label>
                      <Input type="time" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} />
                    </div>
                  </div>
                </div>
              {scheduleError && <p className="text-xs text-[--destructive]">{scheduleError}</p>}
              <div className="flex flex-col gap-2">
                <Button type="button" disabled={isSchedulePending} onClick={handleScheduleSave}>
                  {isSchedulePending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.taskDetail.saveScheduleBtn}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)}>
                  {t.taskDetail.cancelScheduleBtn}
                </Button>
              </div>
            </div>
          )}
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

        <p className="text-[10px] text-[--muted-foreground]/50">
          {t.taskDetail.createdAt(formatDate(task.createdAt))}
        </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--liquid-glass-border-soft)] flex-shrink-0 bg-[var(--liquid-glass-bg)]">
        {mode === "edit" ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 h-8 text-sm"
              onClick={() => setMode("view")}
            >
              {t.taskDetail.cancelBtn}
            </Button>
            <Button
              className="flex-1 h-8 text-sm"
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
        ) : null}
      </div>
    </div>
  )
}
