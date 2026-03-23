"use client"
import { useState, useTransition } from "react"
import { updateTask, deleteTask } from "@/lib/actions/tasks"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { Badge } from "@/components/ui/badge"
import { cn, getDueLabel, isOverdue, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS, formatDate } from "@/lib/utils"
import {
  Pencil, Trash2, Loader2, Clock, AlertCircle, CalendarDays,
  AlignLeft, Tag as TagIcon, X, CheckSquare,
} from "lucide-react"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
}

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "低" },
  { value: "MEDIUM", label: "中" },
  { value: "HIGH", label: "高" },
  { value: "URGENT", label: "紧急" },
]

const STATUS_OPTIONS = [
  { value: "TODO", label: "待办" },
  { value: "DOING", label: "进行中" },
  { value: "DONE", label: "已完成" },
]

const STATUS_BADGE_COLOR: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  DOING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
}

interface TaskDetailDialogProps {
  task: TaskWithRelations
  allTags: Tag[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({ task, allTags, open, onOpenChange }: TaskDetailDialogProps) {
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Edit form state
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [priority, setPriority] = useState<string>(task.priority)
  const [status, setStatus] = useState<string>(task.status)
  const [dueAt, setDueAt] = useState(
    task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(task.taskTags.map((tt) => tt.tagId))

  const overdue = task.status !== "DONE" && isOverdue(task.dueAt)
  const dueLabel = getDueLabel(task.dueAt)

  const handleSave = () => {
    startTransition(async () => {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority as any,
        status: status as any,
        dueAt: dueAt || null,
        tagIds: selectedTags,
      })
      setMode("view")
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTask(task.id)
      onOpenChange(false)
    })
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset edit state after close
    setTimeout(() => {
      setMode("view")
      setConfirmDelete(false)
      setTitle(task.title)
      setDescription(task.description ?? "")
      setPriority(task.priority)
      setStatus(task.status)
      setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : "")
      setSelectedTags(task.taskTags.map((tt) => tt.tagId))
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base">
              {mode === "edit" ? "编辑任务" : "任务详情"}
            </DialogTitle>
            <div className="flex gap-1.5">
              {mode === "view" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMode("edit")}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />编辑
                </Button>
              )}
              {!confirmDelete ? (
                <Button
                  size="sm" variant="ghost"
                  className="h-7 px-2 text-xs text-[--destructive] hover:text-[--destructive] hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />删除
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm" variant="destructive"
                    className="h-7 px-2 text-xs"
                    disabled={isPending}
                    onClick={handleDelete}
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "确认删除"}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    取消
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-4 pt-1">
            {/* Title */}
            <div>
              <p className={cn("text-base font-medium", task.status === "DONE" && "line-through text-[--muted-foreground]")}>
                {task.title}
              </p>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGE_COLOR[task.status] ?? STATUS_BADGE_COLOR.TODO)}>
                {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] ?? task.status}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full bg-[--muted] font-medium", PRIORITY_COLORS[task.priority])}>
                优先级：{PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
              </span>
              {dueLabel && (
                <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", overdue ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-[--muted] text-[--muted-foreground]")}>
                  {overdue ? <AlertCircle className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
                  {dueLabel}
                </span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                  <AlignLeft className="w-3.5 h-3.5" />备注
                </p>
                <p className="text-sm text-[--foreground] bg-[--muted]/50 rounded-lg p-3 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Tags */}
            {task.taskTags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5" />标签
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {task.taskTags.map(({ tag }) => (
                    <TagChip key={tag.id} name={tag.name} color={tag.color} />
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            {task.subTasks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[--muted-foreground] flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />子任务 ({task.subTasks.filter(s => s.done).length}/{task.subTasks.length})
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

            {/* Timestamps */}
            <p className="text-xs text-[--muted-foreground]">
              创建于 {formatDate(task.createdAt)}
              {task.updatedAt !== task.createdAt && `  ·  更新于 ${formatDate(task.updatedAt)}`}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>标题 *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="可选备注..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>状态</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>截止时间</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            {allTags.length > 0 && (
              <div className="space-y-1.5">
                <Label>标签</Label>
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
              <Button type="button" variant="ghost" onClick={() => setMode("view")}>取消</Button>
              <Button type="button" disabled={isPending || !title.trim()} onClick={handleSave}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
