"use client"
import { useTransition } from "react"
import { processInboxItem, deleteInboxItem } from "@/lib/actions/inbox"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Inbox, CheckSquare, BookOpen, Layers, Trash2, Loader2 } from "lucide-react"
import { formatRelative } from "@/lib/utils"
import { useT } from "@/contexts/locale-context"
import type { InboxItem } from "@prisma/client"

export function InboxList({ items }: { items: InboxItem[] }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()

  const handleProcess = (id: string, type: "TASK" | "NOTE" | "BOTH") => {
    startTransition(async () => {
      await processInboxItem(id, type)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteInboxItem(id)
    })
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="w-12 h-12" />}
        title={t.inbox.emptyTitle}
        description={t.inbox.emptyDesc}
      />
    )
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {items.map((item) => (
        <div key={item.id} className="p-4 rounded-xl space-y-3 card-hover bg-[var(--liquid-glass-bg)] border border-[var(--liquid-glass-border)] backdrop-blur-md shadow-[var(--liquid-glass-shadow-soft)]">
          <div className="flex items-start gap-3">
            <Inbox className="w-4 h-4 text-[--muted-foreground] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{item.content}</p>
              <p className="text-xs text-[--muted-foreground] mt-1">{formatRelative(item.capturedAt)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:flex-wrap pl-7">
            <Button size="sm" variant="outline" className="gap-1.5 h-9 md:h-7 text-xs" onClick={() => handleProcess(item.id, "TASK")} disabled={isPending}>
              <CheckSquare className="w-3.5 h-3.5" />{t.inbox.toTask}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-9 md:h-7 text-xs" onClick={() => handleProcess(item.id, "NOTE")} disabled={isPending}>
              <BookOpen className="w-3.5 h-3.5" />{t.inbox.toNote}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-9 md:h-7 text-xs" onClick={() => handleProcess(item.id, "BOTH")} disabled={isPending}>
              <Layers className="w-3.5 h-3.5" />{t.inbox.toBoth}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 h-9 md:h-7 text-xs text-[--destructive] hover:text-[--destructive]" onClick={() => handleDelete(item.id)} disabled={isPending}>
              <Trash2 className="w-3.5 h-3.5" />{t.inbox.deleteBtn}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
