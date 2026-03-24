"use client"
import { useState } from "react"
import {
  format, startOfWeek, addDays, isSameDay,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
} from "date-fns"
import { DayPicker, type DayProps } from "react-day-picker"
import { cn, toChina } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import { useIsMobile } from "@/hooks/use-is-mobile"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"
import { WeekTimeGrid } from "@/components/timeline/week-time-grid"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks?: SubTask[]
  timeBlocks?: TimeBlock[]
}

const PRIORITY_DOT: Record<string, string> = {
  LOW:    "bg-stone-300",
  MEDIUM: "bg-sky-400",
  HIGH:   "bg-orange-400",
  URGENT: "bg-red-500",
}

const PRIORITY_PILL: Record<string, string> = {
  LOW:    "bg-stone-100/80 text-stone-600 dark:bg-stone-800/60 dark:text-stone-300",
  MEDIUM: "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  HIGH:   "bg-orange-100/80 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  URGENT: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

const WEEK_HEADER = ["一", "二", "三", "四", "五", "六", "日"]

/* ─── Week view chips ─── */
function WeekChip({ task, allTags }: { task: TaskWithRelations; allTags: Tag[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cn(
          "text-xs px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-80 transition-opacity",
          PRIORITY_PILL[task.priority],
          task.status === "DONE" && "opacity-40 line-through"
        )}
        title={task.title}
      >
        {task.title}
      </div>
      <TaskDetailDialog task={{ ...task, subTasks: task.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />
    </>
  )
}

/* ─── Month view task row ─── */
function MonthRow({ task, allTags }: { task: TaskWithRelations; allTags: Tag[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cn(
          "flex items-center gap-1 text-[10px] leading-[1.5rem] px-1 rounded-md cursor-pointer",
          "hover:bg-white/50 dark:hover:bg-white/5 transition-colors w-full truncate",
          task.status === "DONE" && "opacity-40 line-through"
        )}
        title={task.title}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[task.priority])} />
        <span className="truncate text-[--foreground]/80">{task.title}</span>
      </div>
      <TaskDetailDialog task={{ ...task, subTasks: task.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />
    </>
  )
}

/* ─── Main component ─── */
export function TimelineView({ tasks, allTags = [] }: { tasks: TaskWithRelations[]; allTags?: Tag[] }) {
  const t = useT()
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"week" | "month">("week")

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const getTasksForDay = (day: Date) => {
    const seen = new Set<string>()
    const result: TaskWithRelations[] = []
    const dayChina = toChina(day)
    for (const t of tasks) {
      if (seen.has(t.id)) continue
      for (const b of (t.timeBlocks ?? [])) {
        if (isSameDay(toChina(b.startAt), dayChina)) {
          seen.add(t.id)
          result.push(t)
          break
        }
      }
    }
    return result
  }

  const prev = () => setCurrentDate(view === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))
  const next = () => setCurrentDate(view === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())

  const title = view === "week"
    ? `${format(weekDays[0], "M月d日", { locale: t.dateFnsLocale })} – ${format(weekDays[6], "M月d日", { locale: t.dateFnsLocale })}`
    : format(currentDate, "yyyy年 M月", { locale: t.dateFnsLocale })

  /* Month day cell — each day is its own floating glass card */
  function MonthDayCell({ day, modifiers }: DayProps) {
    const date = day.date
    const today = !!modifiers.today
    const outside = !!modifiers.outside
    const dayTasks = getTasksForDay(date)
    const MAX = 3

    return (
      <div
        className={cn(
          "relative flex flex-col overflow-hidden transition-all duration-200",
          isMobile ? "rounded-lg min-h-[50px] p-1" : "rounded-xl min-h-[80px] md:min-h-[100px] p-1.5",
          !today && !outside && [
            "bg-white/55 dark:bg-white/[0.04]",
            "border border-white/60 dark:border-white/[0.07]",
            "shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
            "dark:shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]",
            !isMobile && "hover:bg-white/75 dark:hover:bg-white/[0.07]",
          ],
          today && [
            "bg-[--primary]/10 dark:bg-[--primary]/15",
            "border border-[--primary]/25 dark:border-[--primary]/20",
            "shadow-[0_4px_16px_rgba(201,100,68,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]",
          ],
          outside && [
            "bg-white/20 dark:bg-white/[0.015]",
            "border border-white/30 dark:border-white/[0.04]",
          ],
        )}
      >
        {/* Date number */}
        <div className="flex justify-end mb-0.5">
          {today ? (
            <span className={cn(
              "flex items-center justify-center rounded-full bg-[--primary] text-[--primary-foreground] font-bold",
              isMobile ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]",
            )}>
              {format(date, "d")}
            </span>
          ) : (
            <span className={cn(
              "font-medium px-0.5",
              isMobile ? "text-[9px]" : "text-[11px]",
              outside ? "text-[--muted-foreground]/50" : "text-[--foreground]/70"
            )}>
              {format(date, "d")}
            </span>
          )}
        </div>

        {/* Mobile: colored dots | Desktop: task text rows */}
        {isMobile ? (
          <div className="flex gap-0.5 flex-wrap justify-center mt-auto">
            {dayTasks.slice(0, 4).map((task) => (
              <span key={task.id} className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-px overflow-hidden">
            {dayTasks.slice(0, MAX).map((task) => (
              <MonthRow key={task.id} task={task} allTags={allTags} />
            ))}
            {dayTasks.length > MAX && (
              <p className="text-[9px] text-[--muted-foreground]/60 pl-1 leading-4">
                {t.timeline.moreItems(dayTasks.length - MAX)}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 min-w-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={prev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
            <Calendar className="w-3.5 h-3.5 mr-1" />{t.timeline.today}
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={next}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold ml-1">{title}</span>
        </div>
        <div className="flex rounded-lg bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/[0.1] backdrop-blur-sm overflow-hidden text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          {([["week", t.timeline.weekView], ["month", t.timeline.monthView]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("px-3 py-1.5 transition-all duration-150", view === v ? "bg-[--primary] text-[--primary-foreground] shadow-sm" : "hover:bg-white/50 dark:hover:bg-white/[0.08]")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <WeekTimeGrid tasks={tasks} allTags={allTags} weekDays={weekDays} isMobile={isMobile} />
      )}

      {/* ── MONTH CALENDAR — liquid glass ── */}
      {view === "month" && (
        <div
          className={cn(
            "rounded-3xl overflow-hidden p-3",
            // Outer frosted container
            "bg-[--muted]/60 dark:bg-[--muted]/40",
            "backdrop-filter backdrop-blur-2xl",
            "border border-white/40 dark:border-white/[0.06]",
            "shadow-[0_8px_40px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.6)]",
            "dark:shadow-[0_8px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-2">
            {WEEK_HEADER.map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-semibold text-[--muted-foreground]/70 tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* DayPicker grid */}
          <DayPicker
            month={currentDate}
            locale={t.dateFnsLocale}
            weekStartsOn={1}
            showOutsideDays
            classNames={{
              months: "w-full",
              month: "w-full",
              month_caption: "hidden",
              nav: "hidden",
              month_grid: "w-full",
              weekdays: "hidden",
              weeks: "flex flex-col gap-1 md:gap-1.5",
              week: "grid grid-cols-7 gap-1 md:gap-1.5",
              day: "",
              day_button: "hidden",
              today: "",
              outside: "",
            }}
            components={{ Day: MonthDayCell }}
          />
        </div>
      )}
    </div>
  )
}
