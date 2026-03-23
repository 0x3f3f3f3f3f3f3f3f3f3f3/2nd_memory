"use client"
import { useTransition } from "react"
import { processInboxItem, deleteInboxItem } from "@/lib/actions/inbox"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Inbox, CheckSquare, BookOpen, Layers, Trash2, Loader2 } from "lucide-react"
import { formatRelative } from "@/lib/utils"
import type { InboxItem } from "@prisma/client"

export function InboxList({ items }: { items: InboxItem[] }) {
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
        title="收件箱是空的"
        description="用右上角的「快速记录」把想法丢进来"
      />
    )
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {items.map((item) => (
        <div key={item.id} className="p-4 rounded-xl border border-[--border] bg-[--card] space-y-3">
          <div className="flex items-start gap-3">
            <Inbox className="w-4 h-4 text-[--muted-foreground] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{item.content}</p>
              <p className="text-xs text-[--muted-foreground] mt-1">{formatRelative(item.capturedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap pl-7">
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => handleProcess(item.id, "TASK")} disabled={isPending}>
              <CheckSquare className="w-3.5 h-3.5" />转为任务
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => handleProcess(item.id, "NOTE")} disabled={isPending}>
              <BookOpen className="w-3.5 h-3.5" />转为笔记
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => handleProcess(item.id, "BOTH")} disabled={isPending}>
              <Layers className="w-3.5 h-3.5" />同时生成
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-[--destructive] hover:text-[--destructive]" onClick={() => handleDelete(item.id)} disabled={isPending}>
              <Trash2 className="w-3.5 h-3.5" />删除
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
