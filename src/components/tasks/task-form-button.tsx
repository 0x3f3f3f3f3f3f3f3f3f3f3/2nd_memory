"use client"
import { useState, useTransition } from "react"
import { createTask } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TagChip } from "@/components/shared/tag-chip"
import { Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/contexts/locale-context"
import type { Tag } from "@prisma/client"

export function TaskFormButton({
  tags,
  buttonClassName,
  labelMode = "adaptive",
}: {
  tags: Tag[]
  buttonClassName?: string
  labelMode?: "adaptive" | "always" | "icon"
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [dueAt, setDueAt] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const PRIORITY_OPTIONS = [
    { value: "LOW", label: t.tasks.priorityLow },
    { value: "MEDIUM", label: t.tasks.priorityMedium },
    { value: "HIGH", label: t.tasks.priorityHigh },
    { value: "URGENT", label: t.tasks.priorityUrgent },
  ]

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("MEDIUM"); setDueAt(""); setSelectedTags([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priority as any,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        tagIds: selectedTags,
      })
      reset()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn("gap-1.5", buttonClassName)}>
          <Plus className="w-4 h-4" />
          {labelMode !== "icon" && (
            <span className={cn(labelMode === "adaptive" && "hidden sm:inline")}>{t.tasks.newTask}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.tasks.newTask}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.tasks.titleLabel}</Label>
            <Input placeholder={t.tasks.titlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t.tasks.notesLabel}</Label>
            <Textarea placeholder={t.tasks.notesPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.tasks.priorityLabel}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.tasks.dueDateLabel}</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t.tasks.tagsLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTags((prev) => prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id])}
                  >
                    <TagChip
                      name={tag.name}
                      color={tag.color}
                      className={cn("cursor-pointer transition-opacity", selectedTags.includes(tag.id) ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-100")}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 bg-[var(--card)]/92 backdrop-blur-sm py-1 -mx-1 px-1 rounded-b-2xl">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.tasks.cancel}</Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.tasks.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
