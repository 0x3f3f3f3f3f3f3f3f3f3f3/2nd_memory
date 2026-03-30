"use client"
import { useState, useEffect } from "react"
import { format, isToday, isBefore, startOfDay, addDays, endOfWeek, addWeeks } from "date-fns"
import { cn, toChina, chinaNow } from "@/lib/utils"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { AlertTriangle, Clock, Flag, CalendarClock, Check, Loader2, ChevronDown, ChevronRight, Pencil } from "lucide-react"
import { cycleTaskStatus } from "@/lib/actions/tasks"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"
import { TaskSubtasks } from "@/components/tasks/task-subtasks"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks?: SubTask[]
  timeBlocks?: TimeBlock[]
}

const P_DOT: Record<string, string> = {
  LOW: "bg-stone-400", MEDIUM: "bg-sky-400", HIGH: "bg-orange-400", URGENT: "bg-red-500",
}

const STATUS_ICON_COLOR: Record<string, string> = {
  TODO: "border-[--muted-foreground]/40 hover:border-[--primary] hover:bg-[--primary]/10",
  DOING: "border-amber-400 bg-amber-400/10",
  DONE: "border-[#C96444] bg-[#C96444] dark:border-[#D4785A] dark:bg-[#D4785A]",
}

function totalBlockMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((sum, b) => {
    const ms = new Date(b.endAt).getTime() - new Date(b.startAt).getTime()
    return sum + ms / 60000
  }, 0)
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

function TaskCard({
  task, allTags, index, onSelectTask,
}: {
  task: TaskWithRelations
  allTags: Tag[]
  index: number
  onSelectTask?: (task: TaskWithRelations, mode?: "view" | "edit") => void
}) {
  const t = useT()
  // Fallback dialog state when no onSelectTask provided (backward compat)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [localStatus, setLocalStatus] = useState(task.status)
  const [isPending, setIsPending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLocalStatus(task.status)
  }, [task.status])

  const blocks = task.timeBlocks ?? []
  const scheduledMin = totalBlockMinutes(blocks)
  const estimateMin = task.estimateMinutes ?? 0
  const hasEstimate = estimateMin > 0
  const progress = hasEstimate ? Math.min(scheduledMin / estimateMin, 1) : 0
  const isOverdue = task.dueAt && isBefore(toChina(task.dueAt), startOfDay(chinaNow())) && localStatus !== "DONE"

  const handleCycle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPending) return
    const next = localStatus === "TODO" ? "DOING" : localStatus === "DOING" ? "DONE" : "TODO"
    setLocalStatus(next as any)
    setIsPending(true)
    cycleTaskStatus(task.id, localStatus).finally(() => setIsPending(false))
  }

  const subTaskCount = (task.subTasks ?? []).length
  const doneSubTaskCount = (task.subTasks ?? []).filter((subTask) => subTask.done).length

  const openEditor = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (onSelectTask) {
      onSelectTask(task, "edit")
    } else {
      setDialogOpen(true)
    }
  }

  const toggleExpanded = () => {
    setExpanded((prev) => !prev)
  }

  return (
    <>
      <div
        data-ddl-task-trigger="true"
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.closest("button, a, input, textarea, select, label, [role='button']")) return
          if (target.closest("[data-task-subtasks-body='true']")) return
          toggleExpanded()
        }}
        className={cn(
          "group flex items-start gap-3 px-3 py-2.5 rounded-2xl cursor-pointer",
          "bg-[var(--liquid-glass-bg)]",
          "border border-[var(--liquid-glass-border)]",
          "backdrop-blur-md",
          "shadow-[var(--liquid-glass-shadow-soft)]",
          "hover:bg-[var(--liquid-glass-hover-bg)]",
          "hover:-translate-y-px",
          "active:scale-[0.99] active:translate-y-0",
          "transition-all duration-200 ease-out",
          "animate-card-enter",
          localStatus === "DONE" && "opacity-50",
        )}
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className="w-full">
          <div className="flex items-center gap-3">
            {/* Status cycle button */}
            <button
              onClick={handleCycle}
              disabled={isPending}
              className={cn(
                "flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                STATUS_ICON_COLOR[localStatus] ?? STATUS_ICON_COLOR.TODO,
                "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 -ml-2 md:ml-0",
              )}
              title={t.taskDetail.statusCycleTitle(localStatus)}
            >
              {localStatus === "DONE" && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
              {localStatus === "DOING" && <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />}
            </button>

            {/* Priority dot */}
            <span className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125",
              P_DOT[task.priority],
              isOverdue && "ring-2 ring-red-400/40 ring-offset-1 ring-offset-transparent",
            )} />

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate transition-colors duration-150",
                "group-hover:text-[--foreground]",
                localStatus === "DONE" && "line-through text-[--muted-foreground]",
              )}>
                {task.title}
              </p>
              {task.taskTags.length > 0 && (
                <div className="flex gap-1 mt-0.5">
                  {task.taskTags.slice(0, 3).map(tt => (
                    <span
                      key={tt.tagId}
                      className="text-[9px] px-1.5 py-px rounded-full bg-[var(--liquid-glass-chip-bg)] text-[--muted-foreground] border border-[var(--liquid-glass-border-soft)]"
                    >
                      {tt.tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {task.dueAt && (
              <span className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                isOverdue
                  ? "bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-700/30"
                  : "bg-[var(--liquid-glass-chip-bg)] text-[--muted-foreground] border border-[var(--liquid-glass-border-soft)]",
              )}>
                {isToday(toChina(task.dueAt))
                  ? t.ddl.today
                  : format(toChina(task.dueAt), "M/d EEE", { locale: t.dateFnsLocale })}
              </span>
            )}

            <div className="flex-shrink-0 w-20 hidden sm:block">
              {hasEstimate ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[--muted-foreground]/70 whitespace-nowrap">
                      {formatDuration(scheduledMin)}/{formatDuration(estimateMin)}
                    </span>
                    {progress >= 1 && <span className="text-[9px] text-emerald-500">✓</span>}
                  </div>
                  <div className="h-1 rounded-full bg-[--foreground]/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        progress >= 1 ? "bg-emerald-500" : progress > 0 ? "bg-[--primary]" : "bg-transparent",
                      )}
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              ) : blocks.length > 0 ? (
                <span className="text-[9px] text-[--muted-foreground]/70">{formatDuration(scheduledMin)}</span>
              ) : (
                <span className="text-[9px] text-[--muted-foreground]/40">{t.ddl.unscheduled}</span>
              )}
            </div>

            <button
              type="button"
              onClick={openEditor}
              className={cn(
                "grid place-items-center flex-shrink-0 h-8 w-8 p-0 rounded-xl border border-[var(--liquid-glass-border-soft)] leading-none",
                "bg-[var(--liquid-glass-bg-soft)] text-[--muted-foreground]",
                "hover:text-[--foreground] hover:bg-[var(--liquid-glass-hover-bg)] hover:-translate-y-px",
                "active:translate-y-0 active:scale-[0.97]",
                "shadow-[var(--liquid-glass-shadow-soft)]",
                "transition-all duration-200 ease-out",
              )}
              title={t.taskDetail.editBtn}
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {(subTaskCount > 0 || expanded) && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toggleExpanded()
              }}
              className="mt-1 flex w-full items-center gap-1 text-[10px] text-[--muted-foreground] hover:text-[--foreground] transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {t.taskDetail.subtasksCount(doneSubTaskCount, subTaskCount)}
            </button>
          )}

          {expanded && (
            <div data-task-subtasks-body="true">
              <TaskSubtasks
                taskId={task.id}
                initialSubTasks={task.subTasks ?? []}
                compact
                showHeader={false}
                className="mt-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Fallback dialog for standalone use */}
      {!onSelectTask && (
        <TaskDetailDialog
          task={{ ...task, subTasks: task.subTasks ?? [] }}
          allTags={allTags}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  )
}

function Section({
  label, icon, tasks, allTags, accent, startIndex = 0, onSelectTask,
}: {
  label: string
  icon?: React.ReactNode
  tasks: TaskWithRelations[]
  allTags: Tag[]
  accent?: string
  startIndex?: number
  onSelectTask?: (task: TaskWithRelations, mode?: "view" | "edit") => void
}) {
  const t = useT()
  if (tasks.length === 0) return null
  return (
    <div className="space-y-2 animate-page-enter">
      <div className={cn("flex items-center gap-2 px-1", accent)}>
        {icon}
        <span className="text-xs font-semibold tracking-wide">{label}</span>
        <div className="flex-1 h-px bg-[--foreground]/[0.06] ml-1" />
        <span className="text-[10px] text-[--muted-foreground]/60 font-normal">{t.ddl.items(tasks.length)}</span>
      </div>
      <div className="space-y-1.5 pl-1">
        {tasks.map((task, i) => (
          <TaskCard key={task.id} task={task} allTags={allTags} index={startIndex + i} onSelectTask={onSelectTask} />
        ))}
      </div>
    </div>
  )
}

export function DdlView({
  tasks,
  allTags,
  onSelectTask,
}: {
  tasks: TaskWithRelations[]
  allTags: Tag[]
  onSelectTask?: (task: TaskWithRelations, mode?: "view" | "edit") => void
}) {
  const t = useT()
  const now = chinaNow()
  const todayStart = startOfDay(now)
  const todayEnd = addDays(todayStart, 1)
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const nextWeekEnd = addWeeks(thisWeekEnd, 1)

  const overdue: TaskWithRelations[] = []
  const today: TaskWithRelations[] = []
  const thisWeek: TaskWithRelations[] = []
  const nextWeek: TaskWithRelations[] = []
  const later: TaskWithRelations[] = []
  const completed: TaskWithRelations[] = []
  const noDue: TaskWithRelations[] = []

  for (const task of tasks) {
    if (task.status === "ARCHIVED") continue
    if (task.status === "DONE") {
      completed.push(task)
      continue
    }
    if (!task.dueAt) { noDue.push(task); continue }
    const d = toChina(task.dueAt)
    if (isBefore(d, todayStart)) {
      overdue.push(task)
    }
    else if (isBefore(d, todayEnd)) today.push(task)
    else if (isBefore(d, thisWeekEnd)) thisWeek.push(task)
    else if (isBefore(d, nextWeekEnd)) nextWeek.push(task)
    else later.push(task)
  }

  const hasAny = overdue.length + today.length + thisWeek.length + nextWeek.length + later.length + completed.length + noDue.length > 0

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[--muted-foreground]">
        <Flag className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm">{t.ddl.emptyTitle}</p>
      </div>
    )
  }

  const o0 = 0
  const o1 = o0 + overdue.length
  const o2 = o1 + today.length
  const o3 = o2 + thisWeek.length
  const o4 = o3 + nextWeek.length
  const o5 = o4 + later.length
  const o6 = o5 + completed.length

  return (
    <div className="space-y-5">
      <Section label={t.ddl.overdue} icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />} tasks={overdue} allTags={allTags} accent="text-red-600 dark:text-red-400" startIndex={o0} onSelectTask={onSelectTask} />
      <Section label={t.ddl.today} icon={<Flag className="w-3.5 h-3.5 text-[--primary]" />} tasks={today} allTags={allTags} accent="text-[--primary]" startIndex={o1} onSelectTask={onSelectTask} />
      <Section label={t.ddl.thisWeek} icon={<Clock className="w-3.5 h-3.5 text-[--muted-foreground]" />} tasks={thisWeek} allTags={allTags} accent="text-[--muted-foreground]" startIndex={o2} onSelectTask={onSelectTask} />
      <Section label={t.ddl.nextWeek} icon={<CalendarClock className="w-3.5 h-3.5 text-[--muted-foreground]/70" />} tasks={nextWeek} allTags={allTags} accent="text-[--muted-foreground]/70" startIndex={o3} onSelectTask={onSelectTask} />
      <Section label={t.ddl.later} icon={<CalendarClock className="w-3.5 h-3.5 text-[--muted-foreground]/50" />} tasks={later} allTags={allTags} accent="text-[--muted-foreground]/50" startIndex={o4} onSelectTask={onSelectTask} />
      <Section label={t.ddl.completed} icon={<Check className="w-3.5 h-3.5 text-emerald-500" />} tasks={completed} allTags={allTags} accent="text-emerald-600 dark:text-emerald-400" startIndex={o5} onSelectTask={onSelectTask} />
      <Section label={t.ddl.unscheduled} icon={<Clock className="w-3.5 h-3.5 text-[--muted-foreground]/30" />} tasks={noDue} allTags={allTags} accent="text-[--muted-foreground]/40" startIndex={o6} onSelectTask={onSelectTask} />
    </div>
  )
}
