"use client"
import { useRef, useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { format, isSameDay, isToday } from "date-fns"
import { useT } from "@/contexts/locale-context"
import { cn, toChina, chinaNow } from "@/lib/utils"
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog"
import { createTimeBlock, updateTimeBlock, deleteTimeBlock, createAllDayBlock, deleteTimeBlocksByIds } from "@/lib/actions/tasks"
import { X } from "lucide-react"
import type { Task, TaskTag, Tag, SubTask, TimeBlock } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks?: SubTask[]
  timeBlocks?: TimeBlock[]
}

interface LocalBlock { startAt: Date; endAt: Date }

const HOUR_HEIGHT = 64
const SNAP = 15
const MIN_DUR = 15
const DEFAULT_DUR = 60
const CHIP_ROW_H = 88   // fixed height of per-day task chips row
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function snapMin(m: number) { return Math.round(m / SNAP) * SNAP }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function midnightMin(d: Date) { const c = toChina(d); return c.getHours() * 60 + c.getMinutes() }
function applyMin(base: Date, min: number): Date {
  const d = new Date(base)
  d.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return d
}
function totalBlockMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((sum, b) => {
    return sum + (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000
  }, 0)
}
function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

/* priority palette */
const P_BG: Record<string, string> = {
  LOW:    "bg-stone-50/80 dark:bg-stone-900/50 border-stone-200/60 dark:border-stone-700/40",
  MEDIUM: "bg-sky-50/80 dark:bg-sky-900/40 border-sky-200/60 dark:border-sky-700/40",
  HIGH:   "bg-orange-50/80 dark:bg-orange-900/40 border-orange-200/60 dark:border-orange-700/40",
  URGENT: "bg-red-50/80 dark:bg-red-900/40 border-red-200/60 dark:border-red-700/40",
}
const P_TEXT: Record<string, string> = {
  LOW: "text-stone-700 dark:text-stone-300",
  MEDIUM: "text-sky-700 dark:text-sky-300",
  HIGH: "text-orange-700 dark:text-orange-300",
  URGENT: "text-red-700 dark:text-red-300",
}
const P_DOT: Record<string, string> = {
  LOW: "bg-stone-400", MEDIUM: "bg-sky-400", HIGH: "bg-orange-400", URGENT: "bg-red-500",
}
const BORDER_L: Record<string, string> = {
  LOW:    "border-l-stone-300 dark:border-l-stone-600",
  MEDIUM: "border-l-sky-400 dark:border-l-sky-500",
  HIGH:   "border-l-orange-400 dark:border-l-orange-500",
  URGENT: "border-l-red-500",
}

/* ── Drag ghost ── */
function DragGhost({ task, x, y, dropTime, dragOffX, dragOffY }: {
  task: TaskWithRelations; x: number; y: number; dropTime: string | null
  dragOffX: number; dragOffY: number
}) {
  const el = (
    <div
      style={{ position: "fixed", left: x - dragOffX, top: y - dragOffY, width: 140, zIndex: 9999, pointerEvents: "none" }}
      className={cn("px-2.5 py-2 rounded-xl border backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.15)] opacity-90 rotate-1", P_BG[task.priority])}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", P_DOT[task.priority])} />
        <p className={cn("text-[11px] font-semibold truncate", P_TEXT[task.priority])}>{task.title}</p>
      </div>
      {dropTime && <p className="text-[10px] text-[--muted-foreground] pl-3">{dropTime}</p>}
    </div>
  )
  return typeof document !== "undefined" ? createPortal(el, document.body) : null
}

/* ── Drop preview ── */
function DropPreview({ top, priority }: { top: number; priority: string }) {
  return (
    <div
      style={{ position: "absolute", top, height: (DEFAULT_DUR / 60) * HOUR_HEIGHT, left: 3, right: 3, zIndex: 8, pointerEvents: "none" }}
      className={cn(
        "rounded-xl border-2 border-dashed opacity-50",
        priority === "URGENT" ? "border-red-400" :
        priority === "HIGH"   ? "border-orange-400" :
        priority === "MEDIUM" ? "border-sky-400" : "border-stone-300",
      )}
    />
  )
}

/* ── Time block on grid ── */
function BlockOnGrid({
  task, block, dayDate,
  colRectsRef, weekDays, allTags,
  localOverride,
  onBlockMove, onBlockDelete,
}: {
  task: TaskWithRelations
  block: TimeBlock
  dayDate: Date
  colRectsRef: React.RefObject<DOMRect[]>
  weekDays: Date[]
  allTags: Tag[]
  localOverride?: LocalBlock
  onBlockMove: (blockId: string, start: Date, end: Date) => void
  onBlockDelete: (blockId: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)
  const timeLabelRef = useRef<HTMLParagraphElement>(null)
  const wasDragged = useRef(false)

  const effectiveStart = localOverride?.startAt ?? new Date(block.startAt)
  const effectiveEnd   = localOverride?.endAt   ?? new Date(block.endAt)

  const startMin = midnightMin(effectiveStart)
  const endMin   = midnightMin(effectiveEnd)
  const dur      = Math.max(endMin - startMin, MIN_DUR)
  const top      = (startMin / 60) * HOUR_HEIGHT
  const height   = Math.max((dur / 60) * HOUR_HEIGHT, 28)
  const showTime = height >= 44

  function fmtMin(m: number) {
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  }

  const onMoveDown = useCallback((e: React.PointerEvent) => {
    const rect = blockRef.current!.getBoundingClientRect()
    if (e.clientY > rect.bottom - 12) return
    e.preventDefault()
    e.stopPropagation()
    wasDragged.current = false

    const origStartMin = startMin
    const origDur      = dur
    const dayIndex     = weekDays.findIndex(d => isSameDay(d, dayDate))
    const startY       = e.clientY
    const startX       = e.clientX
    const el           = blockRef.current!
    const timeEl       = timeLabelRef.current

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY
      const dx = ev.clientX - startX
      if (Math.abs(dy) > 3 || Math.abs(dx) > 3) wasDragged.current = true
      const rawStart = origStartMin + (dy / HOUR_HEIGHT) * 60
      const newStart = snapMin(clamp(rawStart, 0, 24 * 60 - origDur))
      const newEnd   = newStart + origDur
      el.style.top = `${(newStart / 60) * HOUR_HEIGHT}px`
      if (timeEl) {
        timeEl.classList.remove("hidden")
        timeEl.textContent = `${fmtMin(newStart)}–${fmtMin(newEnd)}`
      }
      const rects = colRectsRef.current ?? []
      let targetCol = dayIndex
      for (let i = 0; i < rects.length; i++) {
        if (ev.clientX >= rects[i].left && ev.clientX <= rects[i].right) { targetCol = i; break }
      }
      if (targetCol !== dayIndex && rects[dayIndex] && rects[targetCol]) {
        el.style.transform = `translateX(${rects[targetCol].left - rects[dayIndex].left}px)`
      } else {
        el.style.transform = ""
      }
      el.dataset.curStart  = String(newStart)
      el.dataset.curTarget = String(targetCol)
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      el.style.transform = ""
      if (!wasDragged.current) { setDialogOpen(true); return }
      const newStartMin = parseInt(el.dataset.curStart  ?? String(origStartMin))
      const targetCol   = parseInt(el.dataset.curTarget ?? String(dayIndex))
      const newEndMin   = newStartMin + origDur
      const baseDay  = weekDays[clamp(targetCol, 0, weekDays.length - 1)]
      const newStart = applyMin(baseDay, newStartMin)
      const newEnd   = applyMin(baseDay, Math.min(newEndMin, 24 * 60))
      onBlockMove(block.id, newStart, newEnd)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [startMin, dur, dayDate, weekDays, colRectsRef, onBlockMove, block.id])

  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el      = blockRef.current!
    const timeEl  = timeLabelRef.current
    const startY  = e.clientY
    const origEnd = endMin

    function onMove(ev: PointerEvent) {
      const dy     = ev.clientY - startY
      const rawEnd = origEnd + (dy / HOUR_HEIGHT) * 60
      const newEnd = snapMin(clamp(rawEnd, startMin + MIN_DUR, 24 * 60))
      el.style.height = `${Math.max(((newEnd - startMin) / 60) * HOUR_HEIGHT, 28)}px`
      el.dataset.curEnd = String(newEnd)
      if (timeEl) {
        timeEl.classList.remove("hidden")
        timeEl.textContent = `${fmtMin(startMin)}–${fmtMin(newEnd)}`
      }
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      const newEndMin = parseInt(el.dataset.curEnd ?? String(origEnd))
      const newEnd    = applyMin(dayDate, newEndMin)
      onBlockMove(block.id, effectiveStart, newEnd)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [endMin, startMin, dayDate, effectiveStart, onBlockMove, block.id])

  return (
    <>
      <div
        ref={blockRef}
        data-block-id={block.id}
        style={{ top, height, position: "absolute", left: 3, right: 3, zIndex: 10, touchAction: "none", userSelect: "none" }}
        className={cn(
          "group rounded-xl border select-none overflow-hidden backdrop-blur-md",
          "shadow-[0_2px_12px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.5)]",
          "hover:shadow-[0_4px_20px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.6)]",
          "transition-shadow duration-150",
          P_BG[task.priority],
          task.status === "DONE" && "opacity-50",
        )}
        onPointerDown={onMoveDown}
      >
        <button
          className="absolute top-1 right-1 z-20 w-6 h-6 md:w-4 md:h-4 rounded-full bg-black/20 dark:bg-white/20 flex items-center justify-center hover:bg-black/40 dark:hover:bg-white/40 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 -mt-2 -mr-2 md:mt-0 md:mr-0"
          onPointerDown={e => { e.stopPropagation() }}
          onClick={e => { e.stopPropagation(); onBlockDelete(block.id) }}
        >
          <X className="w-3 h-3 md:w-2.5 md:h-2.5 text-white dark:text-black" />
        </button>

        <div className="px-2 pt-1.5 pb-4 h-full flex flex-col gap-0.5 overflow-hidden cursor-grab active:cursor-grabbing">
          <div className="flex items-start gap-1">
            <span className={cn("mt-[3px] w-1.5 h-1.5 rounded-full flex-shrink-0", P_DOT[task.priority])} />
            <p className={cn("text-[11px] font-semibold leading-tight truncate", P_TEXT[task.priority])}>
              {task.title}
            </p>
          </div>
          <p ref={timeLabelRef} className={cn("text-[10px] opacity-60 pl-2.5", P_TEXT[task.priority], !showTime && "hidden")}>
            {format(toChina(effectiveStart), "HH:mm")}–{format(toChina(effectiveEnd), "HH:mm")}
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-5 md:h-3 cursor-ns-resize flex items-center justify-center"
          style={{ touchAction: "none", minHeight: 20 }}
          onPointerDown={onResizeDown}
        >
          <div className={cn("w-8 h-1 md:h-[3px] rounded-full opacity-50 md:opacity-20 md:group-hover:opacity-70 transition-opacity", P_DOT[task.priority])} />
        </div>
      </div>

      <TaskDetailDialog
        task={{ ...task, subTasks: task.subTasks ?? [] }}
        allTags={allTags}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}

/* ── Day chip (in per-day task row) ── */
function DayChip({ task, day, allTags, onDragStart, onRemove }: {
  task: TaskWithRelations
  day: Date
  allTags: Tag[]
  onDragStart: (task: TaskWithRelations, e: React.PointerEvent) => void
  onRemove: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] select-none cursor-grab active:cursor-grabbing",
          "hover:bg-white/50 dark:hover:bg-white/[0.07] transition-colors",
          P_TEXT[task.priority],
          task.status === "DONE" && "opacity-40 line-through",
        )}
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={e => { e.preventDefault(); onDragStart(task, e) }}
        onClick={() => setDialogOpen(true)}
        title={task.title}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", P_DOT[task.priority])} />
        <span className="flex-1 truncate leading-snug">{task.title}</span>
        <button
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0 hover:text-[--destructive]"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove() }}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
      <TaskDetailDialog
        task={{ ...task, subTasks: task.subTasks ?? [] }}
        allTags={allTags}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}

/* ── All Tasks sidebar card ── */
function TaskCard({ task, onDragStart, onDetailOpen }: {
  task: TaskWithRelations
  onDragStart: (task: TaskWithRelations, e: React.PointerEvent) => void
  onDetailOpen: () => void
}) {
  const scheduledMin = totalBlockMinutes((task.timeBlocks ?? []).filter(b => !b.isAllDay))
  const estimateMin = task.estimateMinutes ?? 0
  const dueStr = task.dueAt ? format(toChina(new Date(task.dueAt)), "M/d") : null

  return (
    <div
      style={{ touchAction: "none", userSelect: "none" }}
      className={cn(
        "px-2.5 py-2 rounded-xl border-l-[3px] cursor-grab active:cursor-grabbing select-none",
        "bg-white/55 dark:bg-white/[0.05]",
        "border border-white/70 dark:border-white/[0.08]",
        "shadow-[0_1px_4px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]",
        "hover:bg-white/75 dark:hover:bg-white/[0.08] hover:-translate-y-px hover:shadow-md",
        "active:scale-[0.97] transition-all duration-150",
        BORDER_L[task.priority],
      )}
      onPointerDown={e => onDragStart(task, e)}
      onClick={onDetailOpen}
    >
      <p className={cn("text-xs font-medium leading-snug truncate", P_TEXT[task.priority])}>
        {task.title}
      </p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        {dueStr && (
          <span className="text-[10px] text-[--muted-foreground]/60">DDL {dueStr}</span>
        )}
        {estimateMin > 0 && (
          <span className="text-[10px] text-[--muted-foreground]/60">
            {scheduledMin > 0
              ? `${formatDuration(scheduledMin)} / ${formatDuration(estimateMin)}`
              : formatDuration(estimateMin)}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── All Tasks sidebar panel ── */
function TaskPanel({
  tasks, allTags, onChipDragStart, isMobile,
}: {
  tasks: TaskWithRelations[]
  allTags: Tag[]
  onChipDragStart: (task: TaskWithRelations, e: React.PointerEvent) => void
  isMobile: boolean
}) {
  const t = useT()
  const [sel, setSel] = useState<TaskWithRelations | null>(null)
  const [open, setOpen] = useState(false)

  /* Mobile: horizontal chip strip */
  if (isMobile) {
    if (tasks.length === 0) return null
    return (
      <div className={cn(
        "mb-3 px-3 py-2.5 rounded-2xl",
        "max-h-24 overflow-x-auto overflow-y-hidden",
        "bg-white/40 dark:bg-white/[0.03]",
        "border border-white/50 dark:border-white/[0.06]",
        "backdrop-blur-md",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)]",
      )}>
        <p className="text-[11px] font-semibold text-[--muted-foreground] mb-2">
          {t.timeline.taskPanelMobile}
        </p>
        <div className="flex gap-1.5 flex-nowrap">
          {tasks.map(tk => (
            <div
              key={tk.id}
              style={{ userSelect: "none" }}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg border flex-shrink-0 active:scale-95 transition-all",
                P_BG[tk.priority], P_TEXT[tk.priority],
              )}
              onClick={() => { setSel(tk); setOpen(true) }}
            >
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle -mt-px", P_DOT[tk.priority])} />
              {tk.title}
            </div>
          ))}
        </div>
        {sel && (
          <TaskDetailDialog task={{ ...sel, subTasks: sel.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />
        )}
      </div>
    )
  }

  /* Desktop: sidebar */
  return (
    <div className={cn(
      "flex flex-col w-52 flex-shrink-0 rounded-3xl overflow-hidden",
      "bg-[--muted]/30 dark:bg-[--muted]/15",
      "backdrop-filter backdrop-blur-2xl",
      "border border-white/40 dark:border-white/[0.07]",
      "shadow-[0_8px_40px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]",
      "dark:shadow-[0_8px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
    )}>
      <div className={cn(
        "px-3.5 py-3 flex-shrink-0",
        "bg-white/60 dark:bg-black/20 backdrop-blur-xl",
        "border-b border-white/40 dark:border-white/[0.06]",
      )}>
        <p className="text-sm font-semibold">{t.timeline.taskPanelTitle}</p>
        <p className="text-[10px] text-[--muted-foreground]/60 mt-0.5">{t.timeline.taskPanelHint}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {tasks.length === 0 && (
          <p className="text-[11px] text-[--muted-foreground]/40 text-center mt-10">
            {t.timeline.noTasks}
          </p>
        )}
        {tasks.map(tk => (
          <TaskCard
            key={tk.id}
            task={tk}
            onDragStart={onChipDragStart}
            onDetailOpen={() => { setSel(tk); setOpen(true) }}
          />
        ))}
      </div>

      {sel && (
        <TaskDetailDialog task={{ ...sel, subTasks: sel.subTasks ?? [] }} allTags={allTags} open={open} onOpenChange={setOpen} />
      )}
    </div>
  )
}

/* ── Glass hour cells ── */
function HourCells({ today }: { today: boolean }) {
  return (
    <>
      {HOURS.map(h => {
        const isWorkHour = h >= 8 && h < 19
        return (
          <div
            key={h}
            style={{ position: "absolute", top: h * HOUR_HEIGHT + 1, height: HOUR_HEIGHT - 2, left: 2, right: 2, zIndex: 0, borderRadius: 8 }}
            className={cn(
              isWorkHour ? "bg-white/[0.055] dark:bg-white/[0.03]" : "bg-white/[0.02] dark:bg-white/[0.01]",
              today && isWorkHour && "bg-[--primary]/[0.025] dark:bg-[--primary]/[0.015]",
            )}
          />
        )
      })}
      {HOURS.map(h => (
        <div
          key={`hh-${h}`}
          style={{ position: "absolute", top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2, left: 8, right: 8, height: 1, zIndex: 1, borderRadius: 1 }}
          className="bg-[--foreground]/[0.06] dark:bg-white/[0.04]"
        />
      ))}
    </>
  )
}

/* ── Main ── */
export function WeekTimeGrid({ tasks, allTags, weekDays, isMobile = false }: {
  tasks: TaskWithRelations[]
  allTags: Tag[]
  weekDays: Date[]
  isMobile?: boolean
}) {
  const t = useT()
  const [localBlocks, setLocalBlocks] = useState<Record<string, LocalBlock>>({})
  const [pendingBlocks, setPendingBlocks] = useState<Array<{
    tempId: string; taskId: string; startAt: Date; endAt: Date
  }>>([])
  const [pendingDayTasks, setPendingDayTasks] = useState<Array<{
    tempId: string; taskId: string; dayIdx: number
  }>>([])
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const todayIdx = weekDays.findIndex(d => isToday(d))
    return todayIdx >= 0 ? todayIdx : 0
  })

  const colRectsRef    = useRef<DOMRect[]>([])
  const colRefs        = useRef<(HTMLDivElement | null)[]>([])
  const chipAreaRefs   = useRef<(HTMLDivElement | null)[]>([])
  const chipAreaRectsRef = useRef<DOMRect[]>([])
  const scrollRef      = useRef<HTMLDivElement>(null)

  const [ghost, setGhost] = useState<{
    task: TaskWithRelations; x: number; y: number; dropTime: string | null
    targetCol: number; targetMin: number; isChipDrop: boolean
    dragOffX: number; dragOffY: number
  } | null>(null)

  const [nowMin, setNowMin] = useState(() => { const n = chinaNow(); return n.getHours() * 60 + n.getMinutes() })
  useEffect(() => {
    const id = setInterval(() => { const n = chinaNow(); setNowMin(n.getHours() * 60 + n.getMinutes()) }, 60_000)
    return () => clearInterval(id)
  }, [])

  function measureAll() {
    colRectsRef.current     = colRefs.current.map(el => el?.getBoundingClientRect() ?? new DOMRect())
    chipAreaRectsRef.current = chipAreaRefs.current.map(el => el?.getBoundingClientRect() ?? new DOMRect())
  }

  useEffect(() => {
    measureAll()
    window.addEventListener("resize", measureAll)
    return () => window.removeEventListener("resize", measureAll)
  }, [weekDays])

  /* Flatten all blocks for a given day (excludes allDay blocks from time grid) */
  function getBlocksForDay(day: Date): { task: TaskWithRelations; block: TimeBlock }[] {
    const results: { task: TaskWithRelations; block: TimeBlock }[] = []
    const dayChina = toChina(day)
    for (const task of tasks) {
      for (const block of (task.timeBlocks ?? [])) {
        if (block.isAllDay) continue  // allDay blocks go to chip row, not grid
        const start = localBlocks[block.id]?.startAt ?? new Date(block.startAt)
        if (isSameDay(toChina(start), dayChina)) {
          results.push({ task, block })
        }
      }
    }
    for (const pb of pendingBlocks) {
      if (isSameDay(toChina(pb.startAt), dayChina)) {
        const task = tasks.find(t => t.id === pb.taskId)
        if (task) {
          results.push({
            task,
            block: {
              id: pb.tempId, taskId: pb.taskId,
              startAt: pb.startAt, endAt: pb.endAt,
              isAllDay: false,
              createdAt: new Date(), updatedAt: new Date(),
            } as TimeBlock,
          })
        }
      }
    }
    return results
  }

  /* Unique tasks assigned to a day (allDay OR timed blocks) */
  function getUniqueTasksForDay(day: Date): TaskWithRelations[] {
    const dayChina = toChina(day)
    const seen = new Set<string>()
    const result: TaskWithRelations[] = []
    for (const task of tasks) {
      if (seen.has(task.id)) continue
      const hasBlock = (task.timeBlocks ?? []).some(b => {
        const start = localBlocks[b.id]?.startAt ?? new Date(b.startAt)
        return isSameDay(toChina(start), dayChina)
      })
      if (hasBlock) { seen.add(task.id); result.push(task) }
    }
    // pending timed blocks
    for (const pb of pendingBlocks) {
      if (seen.has(pb.taskId)) continue
      if (isSameDay(toChina(pb.startAt), dayChina)) {
        const task = tasks.find(t => t.id === pb.taskId)
        if (task) { seen.add(task.id); result.push(task) }
      }
    }
    return result
  }

  /* Move/resize an existing block */
  const onBlockMove = useCallback(async (blockId: string, start: Date, end: Date) => {
    setLocalBlocks(prev => ({ ...prev, [blockId]: { startAt: start, endAt: end } }))
    try { await updateTimeBlock(blockId, start, end) } catch {}
  }, [])

  /* Delete a block */
  const onBlockDelete = useCallback(async (blockId: string) => {
    setPendingBlocks(prev => prev.filter(pb => pb.tempId !== blockId))
    try { await deleteTimeBlock(blockId) } catch {}
  }, [])

  /* Remove a task from a day's chip area (deletes all its blocks on that day) */
  const onRemoveFromDay = useCallback(async (task: TaskWithRelations, day: Date) => {
    const dayChina = toChina(day)
    const blockIds = (task.timeBlocks ?? [])
      .filter(b => isSameDay(toChina(new Date(b.startAt)), dayChina))
      .map(b => b.id)
    if (blockIds.length > 0) {
      try { await deleteTimeBlocksByIds(blockIds) } catch {}
    }
  }, [])

  /* Determine drop target: chip row or time grid */
  const computeDrop = useCallback((cx: number, cy: number) => {
    // Check chip areas first
    const chipRects = chipAreaRectsRef.current ?? []
    for (let i = 0; i < chipRects.length; i++) {
      const r = chipRects[i]
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        return { col: i, min: 0, isChipDrop: true }
      }
    }
    // Check time grid columns by x-range
    const rects = colRectsRef.current ?? []
    let col = -1
    for (let i = 0; i < rects.length; i++) {
      if (cx >= rects[i].left && cx <= rects[i].right) { col = i; break }
    }
    if (col === -1) return { col: -1, min: 0, isChipDrop: false }
    // If pointer is above the scrollable body → treat as chip drop for that column
    const scrollBodyTop = scrollRef.current?.getBoundingClientRect().top ?? 0
    if (cy < scrollBodyTop) {
      return { col, min: 0, isChipDrop: true }
    }
    const yInCol = cy - rects[col].top
    const rawMin = (yInCol / HOUR_HEIGHT) * 60
    const min = snapMin(clamp(rawMin, 0, 24 * 60 - DEFAULT_DUR))
    return { col, min, isChipDrop: false }
  }, [])

  /* Drag from panel/chip to create a new block */
  const startPanelDrag = useCallback((task: TaskWithRelations, e: React.PointerEvent) => {
    e.preventDefault()
    let didDrag = false
    const startX = e.clientX
    const startY = e.clientY
    // Center the ghost horizontally on the cursor, cursor near the top
    const dragOffX = 70  // half of ghost width (140)
    const dragOffY = 16

    function onMove(ev: PointerEvent) {
      if (!didDrag && (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5)) {
        didDrag = true
      }
      if (!didDrag) return
      const { col, min, isChipDrop } = computeDrop(ev.clientX, ev.clientY)
      const dropTime = col >= 0 && !isChipDrop
        ? `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")} – ${String(Math.floor((min + DEFAULT_DUR) / 60)).padStart(2, "0")}:${String((min + DEFAULT_DUR) % 60).padStart(2, "0")}`
        : null
      setGhost({ task, x: ev.clientX, y: ev.clientY, dropTime, targetCol: col, targetMin: min, isChipDrop, dragOffX, dragOffY })
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      setGhost(null)
      if (!didDrag) return
      const { col, min, isChipDrop } = computeDrop(ev.clientX, ev.clientY)
      if (col < 0) return

      const baseDay = weekDays[col]

      if (isChipDrop) {
        // Add task to day chip row (allDay block)
        if (getUniqueTasksForDay(baseDay).some(tk => tk.id === task.id)) return
        const tempId = `pending-day-${Date.now()}`
        setPendingDayTasks(prev => [...prev, { tempId, taskId: task.id, dayIdx: col }])
        createAllDayBlock(task.id, format(baseDay, "yyyy-MM-dd")).then(() => {
          setPendingDayTasks(prev => prev.filter(p => p.tempId !== tempId))
        }).catch(() => {
          setPendingDayTasks(prev => prev.filter(p => p.tempId !== tempId))
        })
      } else {
        // Add timed block to time grid
        const newStart = applyMin(baseDay, min)
        const newEnd   = applyMin(baseDay, min + DEFAULT_DUR)
        const tempId = `pending-${Date.now()}`
        setPendingBlocks(prev => [...prev, { tempId, taskId: task.id, startAt: newStart, endAt: newEnd }])
        createTimeBlock(task.id, newStart, newEnd).then(() => {
          setPendingBlocks(prev => prev.filter(pb => pb.tempId !== tempId))
        }).catch(() => {
          setPendingBlocks(prev => prev.filter(pb => pb.tempId !== tempId))
        })
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [weekDays, computeDrop])

  /* scroll to 8:00 on mount */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT
  }, [])

  const panelTasks = tasks.filter(t => t.status !== "DONE" && t.status !== "ARCHIVED")

  /* ── Mobile: single-day view ── */
  if (isMobile) {
    const selectedDay = weekDays[selectedDayIdx] ?? weekDays[0]
    const today = isToday(selectedDay)
    const dayBlocks = getBlocksForDay(selectedDay)

    return (
      <div className="flex flex-col">
        <TaskPanel tasks={panelTasks} allTags={allTags} onChipDragStart={startPanelDrag} isMobile />

        <div className="flex gap-1 mb-3 px-1">
          {weekDays.map((day, i) => {
            const isSelected = i === selectedDayIdx
            const dayIsToday = isToday(day)
            return (
              <button
                key={i}
                onClick={() => setSelectedDayIdx(i)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-center transition-all duration-150",
                  isSelected
                    ? "bg-[--primary] text-[--primary-foreground] shadow-sm"
                    : dayIsToday
                    ? "bg-[--primary]/10 text-[--primary]"
                    : "bg-white/40 dark:bg-white/[0.04] text-[--muted-foreground]",
                  !isSelected && "active:scale-95",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider">
                  {format(day, "EEE", { locale: t.dateFnsLocale })}
                </p>
                <p className={cn("text-sm font-bold", isSelected ? "" : dayIsToday ? "text-[--primary]" : "text-[--foreground]/70")}>
                  {format(day, "d")}
                </p>
              </button>
            )
          })}
        </div>

        <div
          className={cn(
            "rounded-3xl overflow-hidden",
            "bg-[--muted]/30 dark:bg-[--muted]/15",
            "backdrop-filter backdrop-blur-2xl",
            "border border-white/40 dark:border-white/[0.07]",
            "shadow-[0_8px_40px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]",
            "dark:shadow-[0_8px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
          style={{ height: "calc(100dvh - 200px)", minHeight: 300 }}
        >
          <div ref={scrollRef} className="overflow-y-auto h-full">
            <div className="flex" style={{ minHeight: 24 * HOUR_HEIGHT }}>
              <div className="w-12 flex-shrink-0 relative">
                {HOURS.map(h => (
                  <div key={h} style={{ height: HOUR_HEIGHT }} className="flex items-start justify-end pr-2">
                    {h > 0 && (
                      <span className="text-[9px] text-[--muted-foreground]/40 tabular-nums -translate-y-2">{h}:00</span>
                    )}
                  </div>
                ))}
              </div>
              <div
                ref={el => { colRefs.current[0] = el }}
                className="flex-1 relative"
                style={{ minHeight: 24 * HOUR_HEIGHT }}
              >
                <HourCells today={today} />
                {today && (
                  <div
                    style={{ top: (nowMin / 60) * HOUR_HEIGHT, position: "absolute", left: 0, right: 0, zIndex: 15 }}
                    className="flex items-center pointer-events-none"
                  >
                    <div className="w-2 h-2 rounded-full bg-[--primary] -ml-1 flex-shrink-0 shadow-[0_0_6px_rgba(201,100,68,0.5)]" />
                    <div className="flex-1 border-t border-[--primary] opacity-60" />
                  </div>
                )}
                {dayBlocks.map(({ task, block }) => (
                  <BlockOnGrid
                    key={block.id}
                    task={task}
                    block={block}
                    dayDate={selectedDay}
                    colRectsRef={colRectsRef}
                    weekDays={[selectedDay]}
                    allTags={allTags}
                    localOverride={localBlocks[block.id]}
                    onBlockMove={onBlockMove}
                    onBlockDelete={onBlockDelete}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Desktop: sidebar + 7-column week view ── */
  return (
    <div className="flex gap-3" style={{ height: "calc(100dvh - 260px)", minHeight: 400 }}>
      {/* All Tasks sidebar */}
      <TaskPanel tasks={panelTasks} allTags={allTags} onChipDragStart={startPanelDrag} isMobile={false} />

      {/* Week grid: flex-col so header + scroll fill full height */}
      <div className={cn(
        "flex-1 min-w-0 flex flex-col rounded-3xl overflow-hidden",
        "bg-[--muted]/30 dark:bg-[--muted]/15",
        "backdrop-filter backdrop-blur-2xl",
        "border border-white/40 dark:border-white/[0.07]",
        "shadow-[0_8px_40px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]",
        "dark:shadow-[0_8px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]",
      )}>

        {/* Fixed header: day names + per-day chip rows */}
        <div className={cn(
          "flex-shrink-0",
          "bg-white/60 dark:bg-black/20 backdrop-blur-xl",
          "border-b border-white/40 dark:border-white/[0.06]",
        )}>
          {/* Day name row */}
          <div className="flex">
            <div className="w-12 flex-shrink-0" />
            {weekDays.map((day, i) => {
              const dayIsToday = isToday(day)
              return (
                <div key={i} className={cn("flex-1 py-2.5 text-center", dayIsToday && "bg-[--primary]/[0.05]")}>
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider",
                    dayIsToday ? "text-[--primary]" : "text-[--muted-foreground]/60"
                  )}>
                    {format(day, "EEE", { locale: t.dateFnsLocale })}
                  </p>
                  <div className="flex justify-center mt-0.5">
                    {dayIsToday ? (
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[--primary] text-[--primary-foreground] text-xs font-bold">
                        {format(day, "d")}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-[--foreground]/70">{format(day, "d")}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Per-day task chip rows */}
          <div
            className="flex border-t border-white/30 dark:border-white/[0.04]"
            style={{ height: CHIP_ROW_H }}
          >
            <div className="w-12 flex-shrink-0 flex items-start justify-end pt-2 pr-2 border-r border-white/20 dark:border-white/[0.04]">
              <p className="text-[8px] text-[--muted-foreground]/30 font-medium tracking-wider">任务</p>
            </div>
            {weekDays.map((day, i) => {
              const dayTasks = getUniqueTasksForDay(day)
              const dayTaskIds = new Set(dayTasks.map(t => t.id))
              const pendingForDay = pendingDayTasks.filter(p => p.dayIdx === i && !dayTaskIds.has(p.taskId))
              const isChipTarget = ghost?.isChipDrop && ghost?.targetCol === i
              return (
                <div
                  key={i}
                  ref={el => { chipAreaRefs.current[i] = el }}
                  className={cn(
                    "flex-1 overflow-y-auto p-1 space-y-[2px]",
                    i > 0 && "border-l border-white/20 dark:border-white/[0.04]",
                    isChipTarget && "bg-[--primary]/[0.05] ring-inset ring-1 ring-[--primary]/10",
                    "transition-colors duration-100",
                  )}
                >
                  {dayTasks.length === 0 && pendingForDay.length === 0 && (
                    <p className="text-[9px] text-[--muted-foreground]/20 text-center py-4">—</p>
                  )}
                  {dayTasks.map(task => (
                    <DayChip
                      key={task.id}
                      task={task}
                      day={day}
                      allTags={allTags}
                      onDragStart={startPanelDrag}
                      onRemove={() => onRemoveFromDay(task, day)}
                    />
                  ))}
                  {pendingForDay.map(p => {
                    const task = tasks.find(t => t.id === p.taskId)
                    if (!task) return null
                    return (
                      <DayChip
                        key={p.tempId}
                        task={task}
                        day={day}
                        allTags={allTags}
                        onDragStart={startPanelDrag}
                        onRemove={() => {}}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" onScroll={measureAll}>
          <div className="flex" style={{ minHeight: 24 * HOUR_HEIGHT }}>
            {/* Time gutter */}
            <div className="w-12 flex-shrink-0 relative">
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="flex items-start justify-end pr-2">
                  {h > 0 && (
                    <span className="text-[9px] text-[--muted-foreground]/40 tabular-nums -translate-y-2">{h}:00</span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, colIdx) => {
              const dayIsToday = isToday(day)
              const dayBlocks = getBlocksForDay(day)
              const isDropTarget = ghost?.targetCol === colIdx && !ghost?.isChipDrop
              return (
                <div
                  key={colIdx}
                  ref={el => { colRefs.current[colIdx] = el }}
                  className={cn(
                    "flex-1 relative",
                    colIdx > 0 && "border-l border-white/20 dark:border-white/[0.04]",
                    isDropTarget && "bg-[--primary]/[0.03]",
                  )}
                  style={{ minHeight: 24 * HOUR_HEIGHT }}
                >
                  <HourCells today={dayIsToday} />

                  {isDropTarget && ghost && (
                    <DropPreview top={(ghost.targetMin / 60) * HOUR_HEIGHT} priority={ghost.task.priority} />
                  )}

                  {dayIsToday && (
                    <div
                      style={{ top: (nowMin / 60) * HOUR_HEIGHT, position: "absolute", left: 0, right: 0, zIndex: 15 }}
                      className="flex items-center pointer-events-none"
                    >
                      <div className="w-2 h-2 rounded-full bg-[--primary] -ml-1 flex-shrink-0 shadow-[0_0_6px_rgba(201,100,68,0.5)]" />
                      <div className="flex-1 border-t border-[--primary] opacity-60" />
                    </div>
                  )}

                  {dayBlocks.map(({ task, block }) => (
                    <BlockOnGrid
                      key={block.id}
                      task={task}
                      block={block}
                      dayDate={day}
                      colRectsRef={colRectsRef}
                      weekDays={weekDays}
                      allTags={allTags}
                      localOverride={localBlocks[block.id]}
                      onBlockMove={onBlockMove}
                      onBlockDelete={onBlockDelete}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {ghost && <DragGhost task={ghost.task} x={ghost.x} y={ghost.y} dropTime={ghost.dropTime} dragOffX={ghost.dragOffX} dragOffY={ghost.dragOffY} />}
    </div>
  )
}
