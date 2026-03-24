"use client"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  format, startOfWeek, addDays, isSameDay,
  addWeeks, subWeeks, addMonths, subMonths,
  eachDayOfInterval, isToday, isTomorrow,
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  endOfWeek,
} from "date-fns"
import { DayPicker, type DayProps } from "react-day-picker"
import { cn, toChina, chinaNow } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel"
import { DdlView } from "@/components/timeline/ddl-view"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cycleTaskStatus } from "@/lib/actions/tasks"
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

/* ── Small DDL row used in week/month cells ── */
function DdlRow({
  task,
  allTags,
  onSelectTask,
}: {
  task: TaskWithRelations
  allTags: Tag[]
  onSelectTask: (task: TaskWithRelations) => void
}) {
  const [localStatus, setLocalStatus] = useState(task.status)

  const handleCycle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = localStatus === "TODO" ? "DOING" : localStatus === "DOING" ? "DONE" : "TODO"
    setLocalStatus(next as any)
    cycleTaskStatus(task.id, localStatus)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] leading-[1.5rem] px-1 rounded-md cursor-pointer group/row",
        "glass-row-hover w-full",
        localStatus === "DONE" && "opacity-40",
      )}
      title={task.title}
    >
      {/* Cycle button */}
      <button
        onClick={handleCycle}
        className={cn(
          "flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-all",
          localStatus === "DONE"
            ? "border-[--primary] bg-[--primary]/20"
            : localStatus === "DOING"
            ? "border-amber-400 bg-amber-400/20"
            : "border-[--muted-foreground]/30 hover:border-[--primary]/60",
          "min-w-[24px] min-h-[24px] md:min-w-0 md:min-h-0 flex items-center justify-center",
        )}
      />
      <span
        onClick={e => { e.stopPropagation(); onSelectTask(task) }}
        className={cn("truncate text-[--foreground]/80 flex-1", localStatus === "DONE" && "line-through")}
      >
        {task.title}
      </span>
    </div>
  )
}

/* ── Week DDL view ── */
function WeekDdlView({
  tasks, allTags, weekDays, onSelectTask,
}: {
  tasks: TaskWithRelations[]
  allTags: Tag[]
  weekDays: Date[]
  onSelectTask: (task: TaskWithRelations) => void
}) {
  const t = useT()
  const getDdlsForDay = (day: Date) =>
    tasks.filter(task => task.dueAt && isSameDay(toChina(task.dueAt), toChina(day)))

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
                "md:min-h-[160px] p-2 flex flex-col",
                i > 0 && "week-day-divider",
                today && "bg-[--primary]/[0.04]",
              )}
            >
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
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {ddls.map(task => (
                  <DdlRow key={task.id} task={task} allTags={allTags} onSelectTask={onSelectTask} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Month DDL cell ── */
function MonthDdlCell({
  day, modifiers, tasks, allTags, isMobile, onSelectTask,
}: DayProps & {
  tasks: TaskWithRelations[]
  allTags: Tag[]
  isMobile?: boolean
  onSelectTask: (task: TaskWithRelations) => void
}) {
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
        !isMobile && "hover:bg-white/75 dark:hover:bg-white/[0.07] cursor-pointer",
      ],
      today && [
        "bg-[--primary]/10 dark:bg-[--primary]/15",
        "border border-[--primary]/25 dark:border-[--primary]/20",
        "shadow-[0_4px_16px_rgba(201,100,68,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]",
      ],
      outside && "bg-white/20 dark:bg-white/[0.015] border border-white/30 dark:border-white/[0.04]",
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
        <div
          className="flex gap-0.5 flex-wrap justify-center mt-auto cursor-pointer"
          onClick={() => ddls[0] && onSelectTask(ddls[0])}
        >
          {ddls.slice(0, 4).map(t => (
            <span key={t.id} className={cn("w-1.5 h-1.5 rounded-full", P_DOT[t.priority])} />
          ))}
        </div>
      ) : (
        <div className="flex-1 space-y-px overflow-hidden">
          {ddls.slice(0, MAX).map(t => (
            <DdlRow key={t.id} task={t} allTags={allTags} onSelectTask={onSelectTask} />
          ))}
          {ddls.length > MAX && (
            <button
              onClick={() => onSelectTask(ddls[MAX])}
              className="text-[9px] text-[--muted-foreground]/60 pl-1 leading-4 hover:text-[--primary] transition-colors"
            >
              +{ddls.length - MAX} 项
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const WEEK_HEADER = ["一", "二", "三", "四", "五", "六", "日"]

type StatusFilter = "ALL" | "TODO" | "DOING" | "DONE"
type DdlFilter = "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH"

/* ── Main unified DDL workbench ── */
export function DdlPageView({ tasks, allTags }: { tasks: TaskWithRelations[]; allTags: Tag[] }) {
  const t = useT()
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"list" | "week" | "month">("list")
  const [viewKey, setViewKey] = useState(0)
  const [slideDir, setSlideDir] = useState<"right" | "left">("right")
  const VIEW_ORDER = ["list", "week", "month"] as const
  const handleSetView = (newView: "list" | "week" | "month") => {
    const oldIdx = VIEW_ORDER.indexOf(view)
    const newIdx = VIEW_ORDER.indexOf(newView)
    setSlideDir(newIdx > oldIdx ? "right" : "left")
    setViewKey(k => k + 1)
    setView(newView)
  }
  // Two-state system: selectedTask = DOM presence, panelVisible = CSS transition
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const panelVisibleRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [ddlFilter, setDdlFilter] = useState<DdlFilter>("ALL")

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== "ALL" && task.status !== statusFilter) return false
    if (ddlFilter !== "ALL") {
      const now = chinaNow()
      const due = task.dueAt ? toChina(task.dueAt) : null
      if (!due) return false
      if (ddlFilter === "TODAY" && !isToday(due)) return false
      if (ddlFilter === "TOMORROW" && !isTomorrow(due)) return false
      if (ddlFilter === "THIS_WEEK") {
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
        if (due < startOfDay(now) || due > weekEnd) return false
      }
      if (ddlFilter === "THIS_MONTH") {
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)
        if (due < monthStart || due > monthEnd) return false
      }
    }
    return true
  })

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

  const onClosePanel = useCallback(() => {
    // Slide out, then unmount after transition completes
    setPanelVisible(false)
    panelVisibleRef.current = false
    closeTimerRef.current = setTimeout(() => setSelectedTask(null), 450)
  }, [])

  const onSelectTask = useCallback((task: TaskWithRelations) => {
    // Toggle: clicking the already-open task closes the panel
    if (panelVisibleRef.current && selectedTask?.id === task.id) {
      onClosePanel()
      return
    }
    // Cancel any in-progress close animation
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    // Panel already open → just swap content, no animation flicker
    if (panelVisibleRef.current) {
      setSelectedTask(task)
      return
    }
    // Panel closed → animate it open
    setSelectedTask(task)
    setPanelVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setPanelVisible(true)
      panelVisibleRef.current = true
    }))
  }, [selectedTask, onClosePanel])

  // The main view content (shared between desktop + mobile)
  const mainContent = (
    <div className="space-y-3 min-w-0">
      {/* Row 1: Status filter */}
      <div className="flex rounded-lg bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/[0.1] backdrop-blur-sm overflow-hidden text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] w-fit">
        {([
          ["ALL", t.tasks.tabAll],
          ["TODO", t.tasks.tabTodo],
          ["DOING", t.tasks.tabDoing],
          ["DONE", t.tasks.tabDone],
        ] as [StatusFilter, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 transition-all duration-150",
              statusFilter === s
                ? "glass-seg-active"
                : "glass-seg-btn text-[--muted-foreground]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Row 2: DDL date filter — only meaningful in list view */}
      {view === "list" && (
        <div className="flex rounded-lg bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/[0.1] backdrop-blur-sm overflow-hidden text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] w-fit">
          {([
            ["ALL", t.ddl.ddlFilterAll],
            ["TODAY", t.ddl.ddlFilterToday],
            ["TOMORROW", t.ddl.ddlFilterTomorrow],
            ["THIS_WEEK", t.ddl.ddlFilterThisWeek],
            ["THIS_MONTH", t.ddl.ddlFilterThisMonth],
          ] as [DdlFilter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setDdlFilter(f)}
              className={cn(
                "px-3 py-1.5 transition-all duration-150",
                ddlFilter === f
                  ? "glass-seg-active"
                  : "glass-seg-btn text-[--muted-foreground]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Controls bar */}
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
              onClick={() => handleSetView(v)}
              className={cn("px-3 py-1.5", view === v ? "glass-seg-active" : "glass-seg-btn text-[--muted-foreground]")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      <div key={viewKey} className={slideDir === "right" ? "animate-view-right" : "animate-view-left"}>
        {view === "list" && (
          <DdlView tasks={filteredTasks} allTags={allTags} onSelectTask={onSelectTask} />
        )}

        {view === "week" && (
          <WeekDdlView tasks={filteredTasks} allTags={allTags} weekDays={weekDays} onSelectTask={onSelectTask} />
        )}

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
                Day: (props) => (
                  <MonthDdlCell
                    {...props}
                    tasks={filteredTasks}
                    allTags={allTags}
                    isMobile={isMobile}
                    onSelectTask={onSelectTask}
                  />
                ),
              }}
            />
          </div>
        )}
      </div>
    </div>
  )

  // Mobile: full-width main + Dialog (bottom sheet) for task detail
  if (isMobile) {
    return (
      <>
        {mainContent}
        <Dialog open={!!selectedTask} onOpenChange={open => { if (!open) setSelectedTask(null) }}>
          <DialogContent className="p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedTask?.title ?? ""}</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <TaskDetailPanel
                task={{ ...selectedTask, subTasks: selectedTask.subTasks ?? [] }}
                allTags={allTags}
                onClose={() => setSelectedTask(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Desktop: two-column layout — main content + right panel
  // The outer panel wrapper always lives in the DOM so its width transition plays on both enter and exit.
  // width: 0 → 320px compresses the main column; inner div spring-slides in from the right.
  const PANEL_W = 320
  return (
    <div
      className="flex gap-4 items-start min-w-0"
      onClick={(e) => {
        if (panelVisibleRef.current && panelRef.current && !panelRef.current.contains(e.target as Node)) {
          onClosePanel()
        }
      }}
    >
      {/* Main content — naturally compressed as panel wrapper expands */}
      <div className="flex-1 min-w-0">
        {mainContent}
      </div>

      {/* Panel wrapper — always in DOM, width animates with ease-out-expo (no overshoot) */}
      <div
        ref={panelRef}
        className="flex-shrink-0 overflow-hidden"
        style={{
          width: panelVisible ? PANEL_W : 0,
          transition: "width 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Inner panel — spring slides in from right (slight overshoot for Apple feel) */}
        {selectedTask && (
          <div
            className="sticky top-4"
            style={{
              width: PANEL_W,
              maxHeight: "calc(100vh - 120px)",
              opacity: panelVisible ? 1 : 0,
              transform: panelVisible ? "translateX(0)" : "translateX(32px)",
              transition: [
                "opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
                "transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)",
              ].join(", "),
            }}
          >
            <TaskDetailPanel
              task={{ ...selectedTask, subTasks: selectedTask.subTasks ?? [] }}
              allTags={allTags}
              onClose={onClosePanel}
            />
          </div>
        )}
      </div>
    </div>
  )
}
