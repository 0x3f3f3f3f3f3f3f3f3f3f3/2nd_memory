"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { createSubTask, toggleSubTask, deleteSubTask } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckSquare, Loader2, Plus, Square, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale, useT } from "@/contexts/locale-context"
import type { SubTask } from "@prisma/client"

interface TaskSubtasksProps {
  taskId: string
  initialSubTasks: SubTask[]
  className?: string
  compact?: boolean
  showHeader?: boolean
}

export function TaskSubtasks({
  taskId,
  initialSubTasks,
  className,
  compact = false,
  showHeader = true,
}: TaskSubtasksProps) {
  const t = useT()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [subTasks, setSubTasks] = useState(initialSubTasks)
  const [draftTitle, setDraftTitle] = useState("")

  useEffect(() => {
    setSubTasks(initialSubTasks)
  }, [initialSubTasks, taskId])

  const sorted = useMemo(
    () => [...subTasks].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime()),
    [subTasks]
  )

  const doneCount = sorted.filter((subTask) => subTask.done).length

  const handleCreate = () => {
    const title = draftTitle.trim()
    if (!title) return
    startTransition(async () => {
      const created = await createSubTask(taskId, title)
      setSubTasks((prev) => [...prev, created])
      setDraftTitle("")
    })
  }

  const handleToggle = (subTask: SubTask) => {
    startTransition(async () => {
      setSubTasks((prev) => prev.map((item) => item.id === subTask.id ? { ...item, done: !item.done } : item))
      await toggleSubTask(subTask.id, !subTask.done)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      setSubTasks((prev) => prev.filter((item) => item.id !== id))
      await deleteSubTask(id)
    })
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showHeader && (
        <div className="flex items-center gap-2 text-xs text-[--muted-foreground]">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>{t.taskDetail.subtasksLabel(doneCount, sorted.length)}</span>
        </div>
      )}

      <div className={cn("space-y-1.5 border-l border-[var(--liquid-glass-border-soft)] pl-3", compact && "pl-2")}>
        {sorted.map((subTask) => (
          <div
            key={subTask.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-[var(--liquid-glass-border-soft)] bg-[var(--liquid-glass-bg-soft)]",
              compact ? "px-2 py-1.5" : "px-2.5 py-2",
              subTask.done && "opacity-60"
            )}
          >
            <button
              type="button"
              onClick={() => handleToggle(subTask)}
              className="flex-shrink-0 text-[--muted-foreground] hover:text-[--primary]"
              disabled={isPending}
            >
              {subTask.done ? <CheckSquare className="w-4 h-4 text-[--primary]" /> : <Square className="w-4 h-4" />}
            </button>
            <span className={cn("flex-1 text-sm", subTask.done && "line-through text-[--muted-foreground]")}>
              {subTask.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(subTask.id)}
              className="flex-shrink-0 text-[--muted-foreground] hover:text-[--destructive]"
              disabled={isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <div className={cn("flex items-center gap-2", compact && "pt-1")}>
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={locale === "en" ? "Add subtask..." : "添加子任务..."}
            className={compact ? "h-8 text-xs" : ""}
          />
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            variant="outline"
            disabled={isPending || !draftTitle.trim()}
            onClick={handleCreate}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
