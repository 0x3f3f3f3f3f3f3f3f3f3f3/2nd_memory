"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteNote } from "@/lib/actions/notes"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useT } from "@/contexts/locale-context"

export function NoteActions({ noteId }: { noteId: string }) {
  const t = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteNote(noteId)
      router.push("/notes")
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/notes/${noteId}/edit`}><Pencil className="w-4 h-4 mr-1" />{t.notes.editNote}</Link>
      </Button>
      {!confirmDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-[--destructive] hover:text-[--destructive] hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="w-4 h-4 mr-1" />{t.taskDetail.deleteBtn}
        </Button>
      ) : (
        <div className="flex gap-1">
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.taskDetail.confirmDeleteBtn}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
            {t.taskDetail.cancelBtn}
          </Button>
        </div>
      )}
    </>
  )
}
