"use client"
import { useState, useTransition } from "react"
import { addToInbox } from "@/lib/actions/inbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"
import { useT } from "@/contexts/locale-context"

export function QuickAdd() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      await addToInbox(content.trim())
      setContent("")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t.quickAdd.buttonLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.quickAdd.dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder={t.quickAdd.placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.quickAdd.cancel}</Button>
            <Button type="submit" disabled={isPending || !content.trim()}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.quickAdd.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
