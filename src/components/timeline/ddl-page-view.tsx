"use client"
import { useState } from "react"
import {
  format, startOfWeek, addDays, isSameDay,
  addWeeks, subWeeks, addMonths, subMonths,
  eachDayOfInterval, isToday,
} from "date-fns"
import { DayPicker, type DayProps } from "react-day-picker"
import { cn, toChina } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { DdlView } from "@/components/timeline/ddl-view"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import { useIsMobile } from "@/hooks/use-is-mobile"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks?: SubTask[]
  timeBlocks?: TimeBlock[]
}

const P_DOT: Record<string, string> = {
  LOW: "bg-stone-300", MEDIUM: "bg-sky-400", HIGH: "bg-orange-400", URGENT: "bg-red-500",
}

/* ── DDL row in week/month cells ── */
function DdlRow({ task, allTags }: { task: TaskWithRelations; allTags: Tag[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        className={cn(
          "flex items-center gap-1 text-[10px] leading-[1.5rem] px-1 rounded-md cursor-pointer",
          "hover:bg-white/50 dark:hover:bg-white/5 transition-colors w-full truncate",
          task.status === "DONE" && "opacity-40 line-through",
        )}
        title={task.title}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", P_DOT[task.priority])} />
        <span className="truncate text-[--foreground]/80">{task.title}</span>
      </div>
      <TaskDetailDialog task={{ ...task, subTasks: task.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />
    </>
  )
}

/* ── Week DDL view ── */
function WeekDdlView({ tasks, allTags, weekDays }: {
  tasks: TaskWithRelations[]; allTags: Tag[]; weekDays: Date[]
}) {
  const t = useT()
  const getDdlsForDay = (day: Date) => tasks.filter(task => task.dueAt && isSameDay(toChina(task.dueAt), toChina(day)))

  return (
    <div className={cn(
      "rounded-3xl overflow-hidden",
      "bg-[--muted]/30 dark:bg-[--muted]/15",
      "backdrop-filter backdrop-blur-2xl",
      "border border-white/40 dark:border-white/[0.07]",
      "shadow-[0_8px_40px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]",
      "dark:shadow-[0_8px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
    )}>
      <div className="grid grid-cols-1 md:grid-cols-7">
        {weekDays.map((day, i) => {
          const today = isToday(day)
          const ddls = getDdlsForDay(day)
          return (
            <div
              key={i}
              className={cn(
                "md:min-h-[160px] p-2 md:p-2 flex flex-col",
                i > 0 && "md:border-l border-t md:border-t-0 border-white/20 dark:border-white/[0.04]",
                today && "bg-[--primary]/[0.04]",
              )}
            >
              {/* Day header */}
              <div className="flex md:block md:text-center items-center gap-2 mb-1 md:mb-2">
                <div className="flex items-center gap-1.5 md:block">
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
                    today ? "text-[--primary]" : "text-[--muted-foreground]/60"
                  )}>
                    {format(day, "EEE", { locale: t.dateFnsLocale })}
                  </p>
                  {today ? (
                    <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-[--primary] text-[--primary-foreground] text-xs font-bold md:mt-0.5">
                      {format(day, "d")}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-[--foreground]/70 md:mt-0.5 inline-block">
                      {format(day, "d")}
                    </span>
                  )}
                </div>
                {/* Mobile: show DDL count inline */}
                {ddls.length === 0 && (
                  <p className="text-[10px] text-[--muted-foreground]/30 md:hidden">{t.ddl.noDdl}</p>
                )}
              </div>

              {/* DDL items */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {ddls.length === 0 && (
                  <p className="text-[9px] text-[--muted-foreground]/30 text-center mt-6 hidden md:block">{t.ddl.noDdl}</p>
                )}
                {ddls.map(task => <DdlRow key={task.id} task={task} allTags={allTags} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Month DDL cell ── */
function MonthDdlCell({ day, modifiers, tasks, allTags, isMobile }: DayProps & { tasks: TaskWithRelations[]; allTags: Tag[]; isMobile?: boolean }) {
  const date = day.date
  const today = !!modifiers.today
  const outside = !!modifiers.outside
  const ddls = tasks.filter(t => t.dueAt && isSameDay(new Date(t.dueAt), date))
  const MAX = 3

  return (
    <div className={cn(
      "relative flex flex-col overflow-hidden transition-all duration-200",
      isMobile ? "rounded-lg min-h-[50px] p-1" : "rounded-xl min-h-[80px] md:min-h-[100px] p-1.5",
      !today && !outside && [
        "bg-white/55 dark:bg-white/[0.04]",
        "border border-white/60 dark:border-white/[0.07]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
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
    )}>
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
            outside ? "text-[--muted-foreground]/50" : "text-[--foreground]/70",
          )}>
            {format(date, "d")}
          </span>
        )}
      </div>
      {isMobile ? (
        <div className="flex gap-0.5 flex-wrap justify-center mt-auto">
          {ddls.slice(0, 4).map(t => (
            <span key={t.id} className={cn("w-1.5 h-1.5 rounded-full", P_DOT[t.priority])} />
          ))}
        </div>
      ) : (
        <div className="flex-1 space-y-px overflow-hidden">
          {ddls.slice(0, MAX).map(t => <DdlRow key={t.id} task={t} allTags={allTags} />)}
          {ddls.length > MAX && (
            <p className="text-[9px] text-[--muted-foreground]/60 pl-1 leading-4">+{ddls.length - MAX} 项</p>
          )}
        </div>
      )}
    </div>
  )
}

const WEEK_HEADER = ["一", "二", "三", "四", "五", "六", "日"]

/* ── Main DDL page view ── */
export function DdlPageView({ tasks, allTags }: { tasks: TaskWithRelations[]; allTags: Tag[] }) {
  const t = useT()
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"list" | "week" | "month">("list")

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const prev = () => setCurrentDate(view === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
  const next = () => setCurrentDate(view === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())

  const title = view === "month"
    ? format(currentDate, "yyyy年 M月", { locale: t.dateFnsLocale })
    : view === "week"
    ? `${format(weekDays[0], "M月d日", { locale: t.dateFnsLocale })} – ${format(weekDays[6], "M月d日", { locale: t.dateFnsLocale })}`
    : t.ddl.allDeadlines

  return (
    <div className="space-y-3 min-w-0">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {view !== "list" && (
            <>
              <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={prev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
                <Calendar className="w-3.5 h-3.5 mr-1" />{t.ddl.today}
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={next}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
          <span className="text-sm font-semibold ml-1">{title}</span>
        </div>
        <div className="flex rounded-lg bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/[0.1] backdrop-blur-sm overflow-hidden text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          {([["list", t.ddl.listView], ["week", t.ddl.weekView], ["month", t.ddl.monthView]] as const).map(([v, label]) => (
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

      {/* Views */}
      <div className="animate-page-enter">
        {view === "list" && <DdlView tasks={tasks} allTags={allTags} />}

        {view === "week" && <WeekDdlView tasks={tasks} allTags={allTags} weekDays={weekDays} />}

        {view === "month" && (
          <div className={cn(
            "rounded-3xl overflow-hidden p-3",
            "bg-[--muted]/60 dark:bg-[--muted]/40",
            "backdrop-filter backdrop-blur-2xl",
            "border border-white/40 dark:border-white/[0.06]",
            "shadow-[0_8px_40px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.6)]",
          )}>
            <div className="grid grid-cols-7 mb-2">
              {WEEK_HEADER.map(d => (
                <div key={d} className="py-1 text-center text-[11px] font-semibold text-[--muted-foreground]/70 tracking-wide">{d}</div>
              ))}
            </div>
            <DayPicker
              month={currentDate}
              locale={t.dateFnsLocale}
              weekStartsOn={1}
              showOutsideDays
              classNames={{
                months: "w-full", month: "w-full",
                month_caption: "hidden", nav: "hidden", month_grid: "w-full",
                weekdays: "hidden",
                weeks: "flex flex-col gap-1 md:gap-1.5",
                week: "grid grid-cols-7 gap-1 md:gap-1.5",
                day: "", day_button: "hidden",
                today: "", outside: "",
              }}
              components={{
                Day: (props) => <MonthDdlCell {...props} tasks={tasks} allTags={allTags} isMobile={isMobile} />,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
