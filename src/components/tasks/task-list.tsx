"use client"
import { useState, useCallback, useEffect } from "react"
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
import { TaskItem } from "./task-item"
import { Input } from "@/components/ui/input"
import { TagChip } from "@/components/shared/tag-chip"
import { EmptyState } from "@/components/shared/empty-state"
import { reorderTasks } from "@/lib/actions/tasks"
import { cn } from "@/lib/utils"
import { Search, CheckSquare, GripVertical } from "lucide-react"
import { useT } from "@/contexts/locale-context"
import type { Task, TaskTag, Tag, SubTask } from "@prisma/client"

type TaskWithRelations = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
}

function SortableTaskItem({ task, allTags }: { task: TaskWithRelations; allTags: Tag[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn("flex gap-2 items-start", isDragging && "dragging rounded-lg")}>
      <button
        {...attributes}
        {...listeners}
        className="drag-handle mt-3.5 p-2.5 md:p-1 rounded text-[--muted-foreground] hover:text-[--foreground] hover:bg-[--accent] transition-colors flex-shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <TaskItem task={task} allTags={allTags} />
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

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

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

  return (
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

      <div className="flex gap-1 border-b border-white/40 dark:border-white/[0.08] pb-0">
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
              !activeTag ? "bg-[--primary] text-[--primary-foreground] border-[--primary]" : "border-white/50 dark:border-white/[0.12] text-[--muted-foreground] hover:border-white/70 dark:hover:border-white/[0.2] hover:bg-white/40 dark:hover:bg-white/[0.05]"
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
                <SortableTaskItem key={task.id} task={task} allTags={tags} />
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
  )
}
