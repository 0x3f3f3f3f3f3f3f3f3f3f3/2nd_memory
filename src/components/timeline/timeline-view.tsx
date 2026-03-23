"use client"
import { useState } from "react"
import { format, startOfWeek, addDays, isSameDay, isToday, eachDayOfInterval, addWeeks, subWeeks, startOfMonth, endOfMonth } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks?: SubTask[]
}

const PRIORITY_BG: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/50",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/50",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/50",
}

function TaskChip({ task, allTags }: { task: TaskWithRelations; allTags: Tag[] }) {
  const [open, setOpen] = useState(false)
  const taskWithSubTasks = { ...task, subTasks: task.subTasks ?? [] }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={cn(
          "text-xs px-1.5 py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
          PRIORITY_BG[task.priority],
          task.status === "DONE" && "opacity-50 line-through"
        )}
        title={task.title}
      >
        {task.title}
      </div>
      <TaskDetailDialog
        task={taskWithSubTasks}
        allTags={allTags}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

export function TimelineView({ tasks, allTags = [] }: { tasks: TaskWithRelations[]; allTags?: Tag[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"week" | "month">("week")

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = view === "week"
    ? eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
    : eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })

  const getTasksForDay = (day: Date) =>
    tasks.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), day))

  const prev = () => setCurrentDate(view === "week" ? subWeeks(currentDate, 1) : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  const next = () => setCurrentDate(view === "week" ? addWeeks(currentDate, 1) : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  const goToday = () => setCurrentDate(new Date())

  return (
    <div className="space-y-4 min-w-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            <Calendar className="w-3.5 h-3.5 mr-1" />今天
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">
            {view === "week"
              ? `${format(days[0], "M月d日", { locale: zhCN })} - ${format(days[6], "M月d日", { locale: zhCN })}`
              : format(currentDate, "yyyy年M月", { locale: zhCN })}
          </span>
        </div>
        <div className="flex rounded-lg border border-[--border] overflow-hidden">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("px-3 py-1.5 text-xs transition-colors", view === v ? "bg-[--primary] text-[--primary-foreground]" : "hover:bg-[--accent]")}
            >
              {v === "week" ? "周" : "月"}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop week view */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: "1px" }}>
        {days.map((day) => {
          const dayTasks = getTasksForDay(day)
          return (
            <div key={day.toISOString()} className={cn("min-h-[120px] p-2 rounded-lg border", isToday(day) ? "border-[--primary] bg-[--primary]/5" : "border-[--border] bg-[--card]")}>
              <div className={cn("text-xs font-medium mb-2 text-center", isToday(day) ? "text-[--primary]" : "text-[--muted-foreground]")}>
                <div>{format(day, "EEE", { locale: zhCN })}</div>
                <div className={cn("text-base", isToday(day) ? "text-[--primary] font-bold" : "")}>{format(day, "d")}</div>
              </div>
              <div className="space-y-1">
                {dayTasks.map((task) => (
                  <TaskChip key={task.id} task={task} allTags={allTags} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile agenda view */}
      <div className="md:hidden space-y-2">
        {days.map((day) => {
          const dayTasks = getTasksForDay(day)
          if (dayTasks.length === 0 && !isToday(day)) return null
          return (
            <div key={day.toISOString()} className={cn("p-3 rounded-xl border", isToday(day) ? "border-[--primary] bg-[--primary]/5" : "border-[--border]")}>
              <div className={cn("text-xs font-semibold mb-2", isToday(day) ? "text-[--primary]" : "text-[--muted-foreground]")}>
                {format(day, "M月d日 EEE", { locale: zhCN })}
              </div>
              {dayTasks.length > 0 ? (
                <div className="space-y-1.5">
                  {dayTasks.map((task) => (
                    <TaskChip key={task.id} task={task} allTags={allTags} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[--muted-foreground]">暂无安排</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
