"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TaskItem, type TaskWithRelations } from "./task-item"
import { TaskDetailPanel } from "./task-detail-panel"
import { Input } from "@/components/ui/input"
import { TagChip } from "@/components/shared/tag-chip"
import { EmptyState } from "@/components/shared/empty-state"
import { reorderTasks } from "@/lib/actions/tasks"
import { cn } from "@/lib/utils"
import { Search, CheckSquare, GripVertical } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Tag } from "@prisma/client"

function SortableTaskItem({ task, allTags, onSelect }: { task: TaskWithRelations; allTags: Tag[]; onSelect?: (task: TaskWithRelations) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      data-task-list-trigger="true"
      style={style}
      className={cn("flex gap-2 items-start", isDragging && "dragging rounded-lg")}
    >
      <button
        {...attributes}
        {...listeners}
        className="drag-handle mt-3.5 p-2.5 md:p-1 rounded text-[--muted-foreground] hover:text-[--foreground] hover:bg-[--accent] transition-colors flex-shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <TaskItem task={task} allTags={allTags} onSelect={onSelect} />
      </div>
    </div>
  )
}

export function TaskList({ tasks, tags }: { tasks: TaskWithRelations[]; tags: Tag[] }) {
  const t = useT()
  const [search, setSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState("all")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const panelVisibleRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const STATUS_TABS = [
    { value: "all", label: t.tasks.tabAll },
    { value: "TODO", label: t.tasks.tabTodo },
    { value: "DOING", label: t.tasks.tabDoing },
    { value: "DONE", label: t.tasks.tabDone },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const filtered = localTasks.filter((task) => {
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
    if (activeStatus !== "all" && task.status !== activeStatus) return false
    if (activeTag && !task.taskTags.some((tt) => tt.tagId === activeTag)) return false
    return true
  })

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = filtered.findIndex((t) => t.id === active.id)
      const newIndex = filtered.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(filtered, oldIndex, newIndex)

      const newTasks = [...localTasks]
      const filteredIds = new Set(filtered.map((t) => t.id))
      let filteredIdx = 0
      for (let i = 0; i < newTasks.length; i++) {
        if (filteredIds.has(newTasks[i].id)) {
          newTasks[i] = reordered[filteredIdx++]
        }
      }
      setLocalTasks(newTasks)
      reorderTasks(reordered.map((t) => t.id))
    },
    [filtered, localTasks]
  )

  const onClosePanel = useCallback(() => {
    setPanelVisible(false)
    panelVisibleRef.current = false
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSelectedTask(null)
      closeTimerRef.current = null
    }, 450)
  }, [])

  const onSelectTask = useCallback((task: TaskWithRelations) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (panelVisibleRef.current && selectedTask?.id === task.id) {
      onClosePanel()
      return
    }
    if (panelVisibleRef.current) {
      setSelectedTask(task)
      return
    }
    setSelectedTask(task)
    setPanelVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setPanelVisible(true)
      panelVisibleRef.current = true
    }))
  }, [onClosePanel, selectedTask])

  const onMainAreaClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!panelVisibleRef.current) return

    const target = event.target as HTMLElement
    if (target.closest("[data-task-list-trigger='true']")) return
    if (target.closest("button, a, input, textarea, select, label, [role='button'], [data-radix-popper-content-wrapper]")) return

    onClosePanel()
  }, [onClosePanel])

  const PANEL_W = 320

  return (
    <div className="flex gap-6 items-stretch min-w-0">
      <div className="flex-1 min-w-0" onClick={onMainAreaClick}>
        <div className="space-y-4 max-w-3xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
            <Input
              placeholder={t.tasks.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1 border-b border-[var(--liquid-glass-border-soft)] pb-0">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveStatus(tab.value)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-t-md border-b-2 transition-colors -mb-px",
                  activeStatus === tab.value
                    ? "border-[--primary] text-[--primary] font-medium"
                    : "border-transparent text-[--muted-foreground] hover:text-[--foreground]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTag(null)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  !activeTag ? "bg-[--primary] text-[--primary-foreground] border-[--primary]" : "border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] text-[--muted-foreground] hover:border-[var(--liquid-glass-border)] hover:bg-[var(--liquid-glass-hover-bg)]"
                )}
              >
                {t.tasks.tabAll}
              </button>
              {tags.map((tag) => (
                <button key={tag.id} onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}>
                  <TagChip
                    name={tag.name}
                    color={tag.color}
                    className={cn("cursor-pointer transition-opacity", activeTag && activeTag !== tag.id ? "opacity-40" : "")}
                  />
                </button>
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {filtered.map((task) => (
                    <SortableTaskItem key={task.id} task={task} allTags={tags} onSelect={onSelectTask} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState
              icon={<CheckSquare className="w-10 h-10" />}
              title={search ? t.tasks.noMatchTitle : t.tasks.emptyTitle}
              description={search ? t.tasks.noMatchDesc : t.tasks.emptyDesc}
            />
          )}

          <p className="text-xs text-[--muted-foreground]">{t.tasks.countLabel(filtered.length)}</p>
        </div>
      </div>

      <div
        className="flex-shrink-0 overflow-hidden self-stretch"
        style={{
          width: panelVisible ? PANEL_W : 0,
          transition: "width 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {selectedTask && (
          <div
            className="sticky top-20"
            style={{
              width: PANEL_W,
              height: "calc(100vh - 6.5rem)",
              opacity: panelVisible ? 1 : 0,
              transform: panelVisible ? "translateX(0)" : "translateX(32px)",
              transition: [
                "opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
                "transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)",
              ].join(", "),
            }}
          >
            <TaskDetailPanel
              task={selectedTask}
              allTags={tags}
              onClose={onClosePanel}
            />
          </div>
        )}
      </div>
    </div>
  )
}
