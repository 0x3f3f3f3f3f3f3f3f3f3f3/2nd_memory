"use client"
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import {
  format, startOfWeek, addDays, isSameDay,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
} from "date-fns"
import { DayPicker, type DayProps } from "react-day-picker"
import { cn, toChina } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import { useIsMobile } from "@/hooks/use-is-mobile"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"
import { WeekTimeGrid } from "@/components/timeline/week-time-grid"
import { TaskSidePanel } from "@/components/tasks/task-side-panel"

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
function MonthRow({ task, allTags, onSelectTask }: {
  task: TaskWithRelations
  allTags: Tag[]
  onSelectTask?: (task: TaskWithRelations) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); onSelectTask ? onSelectTask(task) : setOpen(true) }}
        className={cn(
          "flex items-center gap-1 text-[10px] leading-[1.5rem] px-1 rounded-md cursor-pointer",
          "glass-row-hover w-full truncate",
          task.status === "DONE" && "opacity-40 line-through"
        )}
        title={task.title}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[task.priority])} />
        <span className="truncate text-[--foreground]/80">{task.title}</span>
      </div>
      {!onSelectTask && <TaskDetailDialog task={{ ...task, subTasks: task.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />}
    </>
  )
}

/* ─── Main component ─── */
export function TimelineView({ tasks, allTags = [] }: { tasks: TaskWithRelations[]; allTags?: Tag[] }) {
  const t = useT()
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"week" | "month">("week")
  const [viewKey, setViewKey] = useState(0)
  const [slideDir, setSlideDir] = useState<"right" | "left">("right")
  const handleSetView = (newView: "week" | "month") => {
    setSlideDir(newView === "month" ? "right" : "left")
    setViewKey(k => k + 1)
    setView(newView)
  }

  // Right panel state (same two-state system as DdlPageView)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [selectedMode, setSelectedMode] = useState<"view" | "edit">("view")
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const panelVisibleRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedTaskRef = useRef<TaskWithRelations | null>(null)
  const selectedModeRef = useRef<"view" | "edit">("view")
  const selectedBlockIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedTaskRef.current = selectedTask
  }, [selectedTask])

  useEffect(() => {
    selectedModeRef.current = selectedMode
  }, [selectedMode])

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId
  }, [selectedBlockId])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const onClosePanel = useCallback(() => {
    setPanelVisible(false)
    panelVisibleRef.current = false
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSelectedTask(null)
      closeTimerRef.current = null
    }, 450)
  }, [])

  const onSelectTask = useCallback((task: TaskWithRelations, options?: { blockId?: string | null; mode?: "view" | "edit" }) => {
    const nextMode = options?.mode ?? "view"
    const nextBlockId = options?.blockId ?? null
    if (panelVisibleRef.current && selectedTaskRef.current?.id === task.id) {
      if (selectedModeRef.current !== nextMode || selectedBlockIdRef.current !== nextBlockId) {
        setSelectedTask(task)
        setSelectedMode(nextMode)
        setSelectedBlockId(nextBlockId)
        return
      }
      onClosePanel()
      return
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (panelVisibleRef.current) {
      setSelectedTask(task)
      setSelectedMode(nextMode)
      setSelectedBlockId(nextBlockId)
      return
    }
    setSelectedTask(task)
    setSelectedMode(nextMode)
    setSelectedBlockId(nextBlockId)
    setPanelVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setPanelVisible(true)
      panelVisibleRef.current = true
    }))
  }, [onClosePanel])

  const onMainAreaClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!panelVisibleRef.current) return

    const target = event.target as HTMLElement
    if (target.closest("[data-timeline-task-trigger='true']")) return
    if (target.closest("button, a, input, textarea, select, label, [role='button'], [data-radix-popper-content-wrapper]")) return

    onClosePanel()
  }, [onClosePanel])

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }), [weekStart])

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

  const weekView = useMemo(() => (
    <WeekTimeGrid tasks={tasks} allTags={allTags} weekDays={weekDays} isMobile={isMobile} onSelectTask={onSelectTask} />
  ), [tasks, allTags, weekDays, isMobile, onSelectTask])

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
            "bg-[var(--liquid-glass-bg)]",
            "border border-[var(--liquid-glass-border)]",
            "shadow-[var(--liquid-glass-shadow-soft)]",
            !isMobile && "hover:bg-[var(--liquid-glass-hover-bg)]",
          ],
          today && [
            "bg-[--primary]/10 dark:bg-[--primary]/15",
            "border border-[--primary]/25 dark:border-[--primary]/20",
            "shadow-[0_4px_16px_rgba(201,100,68,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]",
          ],
          outside && [
            "bg-[var(--liquid-glass-bg-soft)]",
            "border border-[var(--liquid-glass-border-soft)]",
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
              <MonthRow key={task.id} task={task} allTags={allTags} onSelectTask={onSelectTask} />
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

  const mainContent = (
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
        <div className="flex rounded-lg bg-[var(--liquid-glass-bg-soft)] border border-[var(--liquid-glass-border)] backdrop-blur-sm overflow-hidden text-xs shadow-[var(--liquid-glass-shadow-soft)]">
          {([["week", t.timeline.weekView], ["month", t.timeline.monthView]] as const).map(([v, label]) => (
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

      <div key={viewKey} className={slideDir === "right" ? "animate-view-right" : "animate-view-left"}>
      {/* ── WEEK VIEW ── */}
      {view === "week" && weekView}

      {/* ── MONTH CALENDAR — liquid glass ── */}
      {view === "month" && (
        <div
          className={cn(
            "rounded-3xl overflow-hidden p-3",
            "bg-[var(--liquid-glass-bg-soft)]",
            "backdrop-filter backdrop-blur-2xl",
            "border border-[var(--liquid-glass-border)]",
            "shadow-[var(--liquid-glass-shadow)]",
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
    </div>
  )

  // Mobile: full-width + Dialog bottom sheet
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
                initialMode={selectedMode}
                initialEditingBlockId={selectedBlockId}
                onClose={() => setSelectedTask(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Desktop: main content + spring panel on right
  return (
    <div className="flex gap-6 items-stretch min-w-0">
      <div className="flex-1 min-w-0" onClick={onMainAreaClick}>{mainContent}</div>

      <TaskSidePanel mounted={!!selectedTask} visible={panelVisible}>
        {selectedTask && (
          <TaskDetailPanel
            task={{ ...selectedTask, subTasks: selectedTask.subTasks ?? [] }}
            allTags={allTags}
            initialMode={selectedMode}
            initialEditingBlockId={selectedBlockId}
            onClose={onClosePanel}
          />
        )}
      </TaskSidePanel>
    </div>
  )
}
