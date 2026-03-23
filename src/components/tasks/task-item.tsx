"use client"
import { useState, useTransition } from "react"
import { cycleTaskStatus } from "@/lib/actions/tasks"
import { TagChip } from "@/components/shared/tag-chip"
import { TaskDetailDialog } from "./task-detail-dialog"
import { cn, getDueLabel, isOverdue, PRIORITY_COLORS } from "@/lib/utils"
import { CheckSquare, Square, Loader, ChevronDown, ChevronRight, Clock, AlertCircle } from "lucide-react"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
}

type Status = "TODO" | "DOING" | "DONE"

const STATUS_ICON = {
  TODO: Square,
  DOING: Loader,
  DONE: CheckSquare,
}

const STATUS_COLOR = {
  TODO: "text-[--muted-foreground] hover:text-[--primary]",
  DOING: "text-amber-500 hover:text-amber-600",
  DONE: "text-[--primary] hover:text-[--primary]/80",
}

const STATUS_LABEL = {
  TODO: "待办",
  DOING: "进行中",
  DONE: "已完成",
}

interface TaskItemProps {
  task: TaskWithRelations
  allTags?: Tag[]
}

export function TaskItem({ task, allTags = [] }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [status, setStatus] = useState<Status>((task.status as Status) ?? "TODO")
  const [isPending, startTransition] = useTransition()

  const isDone = status === "DONE"
  const isDoing = status === "DOING"
  const overdue = status !== "DONE" && isOverdue(task.dueAt)
  const dueLabel = getDueLabel(task.dueAt)
  const Icon = STATUS_ICON[status]

  const handleCycle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Status = status === "TODO" ? "DOING" : status === "DOING" ? "DONE" : "TODO"
    setStatus(next)
    startTransition(async () => {
      await cycleTaskStatus(task.id, status)
    })
  }

  return (
    <>
      <div
        onClick={() => setDetailOpen(true)}
        className={cn(
          "group flex gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
          isDone
            ? "border-[--border] opacity-60"
            : isDoing
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10"
            : overdue
            ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10"
            : "border-[--border] bg-[--card] hover:bg-[--accent]"
        )}
      >
        <button
          onClick={handleCycle}
          disabled={isPending}
          title={`点击切换状态（当前：${STATUS_LABEL[status]}）`}
          className={cn("mt-0.5 flex-shrink-0 transition-colors", STATUS_COLOR[status])}
        >
          <Icon className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className={cn("text-sm flex-1", isDone && "line-through text-[--muted-foreground]")}>
              {task.title}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isDoing && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                  进行中
                </span>
              )}
              {task.priority !== "MEDIUM" && (
                <span className={cn("text-xs", PRIORITY_COLORS[task.priority])}>
                  {task.priority === "URGENT" ? "!!!" : task.priority === "HIGH" ? "!!" : "!"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {dueLabel && (
              <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-500" : "text-[--muted-foreground]")}>
                {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {dueLabel}
              </span>
            )}
            {task.taskTags.map(({ tag }) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
          </div>

          {task.subTasks.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="flex items-center gap-1 text-xs text-[--muted-foreground] mt-1.5 hover:text-[--foreground]"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {task.subTasks.filter((s) => s.done).length}/{task.subTasks.length} 子任务
            </button>
          )}

          {expanded && task.subTasks.length > 0 && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-[--border]">
              {task.subTasks.map((sub) => (
                <div key={sub.id} className={cn("text-xs", sub.done && "line-through text-[--muted-foreground]")}>
                  {sub.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskDetailDialog
        task={{ ...task, status: status as any }}
        allTags={allTags}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
