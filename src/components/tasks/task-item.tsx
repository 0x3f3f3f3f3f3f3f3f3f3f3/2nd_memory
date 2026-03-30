"use client"
import { useState, useTransition } from "react"
import { cycleTaskStatus } from "@/lib/actions/tasks"
import { TagChip } from "@/components/shared/tag-chip"
import { cn, getDueLabel, isOverdue, PRIORITY_COLORS } from "@/lib/utils"
import { CheckSquare, Square, Loader, ChevronDown, ChevronRight, Clock, AlertCircle, Pencil } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"
import { TaskSubtasks } from "./task-subtasks"

export type TaskWithRelations = Task & {
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

interface TaskItemProps {
  task: TaskWithRelations
  allTags?: Tag[]
  onSelect?: (task: TaskWithRelations) => void
}

export function TaskItem({ task, allTags = [], onSelect }: TaskItemProps) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<Status>((task.status as Status) ?? "TODO")
  const [isPending, startTransition] = useTransition()

  const STATUS_LABEL: Record<Status, string> = {
    TODO: t.tasks.statusTodo,
    DOING: t.tasks.statusDoing,
    DONE: t.tasks.statusDone,
  }

  const isDone = status === "DONE"
  const isDoing = status === "DOING"
  const overdue = status !== "DONE" && isOverdue(task.dueAt)
  const dueLabel = getDueLabel(task.dueAt, undefined, { suppressOverdue: isDone })
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
        data-task-list-trigger="true"
        onClick={() => task.subTasks.length > 0 && setExpanded((prev) => !prev)}
        className={cn(
          "group flex gap-3 p-3 rounded-xl border transition-all cursor-pointer card-hover",
          "backdrop-blur-md shadow-[var(--liquid-glass-shadow-soft)]",
          isDone
            ? "bg-[var(--liquid-glass-bg-soft)] border-[var(--liquid-glass-border-soft)] opacity-60"
            : isDoing
            ? "bg-amber-50/60 dark:bg-amber-900/15 border-amber-200/60 dark:border-amber-800/30"
            : overdue
            ? "bg-red-50/60 dark:bg-red-900/15 border-red-200/60 dark:border-red-800/30"
            : "bg-[var(--liquid-glass-bg)] border-[var(--liquid-glass-border)] hover:bg-[var(--liquid-glass-hover-bg)]"
        )}
      >
        <button
          onClick={handleCycle}
          disabled={isPending}
          title={t.taskDetail.statusCycleTitle(STATUS_LABEL[status])}
          className={cn("flex-shrink-0 transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:mt-0.5 -ml-2 md:ml-0", STATUS_COLOR[status])}
        >
          <Icon className="w-5 h-5 md:w-4 md:h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className={cn("text-sm flex-1", isDone && "line-through text-[--muted-foreground]")}>
              {task.title}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onSelect && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect(task) }}
                  className="text-[--muted-foreground] hover:text-[--foreground] transition-colors"
                  title={t.taskDetail.editBtn}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {isDoing && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                  {t.tasks.statusDoing}
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
              {t.taskDetail.subtasksCount(task.subTasks.filter((s) => s.done).length, task.subTasks.length)}
            </button>
          )}

          {expanded && task.subTasks.length > 0 && (
            <TaskSubtasks
              taskId={task.id}
              initialSubTasks={task.subTasks}
              compact
              showHeader={false}
              className="mt-2"
            />
          )}
        </div>
      </div>
    </>
  )
}
