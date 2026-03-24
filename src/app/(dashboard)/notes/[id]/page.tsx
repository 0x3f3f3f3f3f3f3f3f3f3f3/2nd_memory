import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { NoteDetail } from "@/components/notes/note-detail"
import { NoteActions } from "@/components/notes/note-actions"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const note = await prisma.note.findUnique({ where: { id, userId } })
  return { title: note?.title ?? "笔记详情" }
}

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const note = await prisma.note.findUnique({
    where: { id, userId },
    include: {
      noteTags: { include: { tag: true } },
      noteTasks: { include: { task: true } },
    },
  })
  if (!note) notFound()

  const tags = await prisma.tag.findMany({ where: { userId: userId } })

  return (
    <div className="flex flex-col">
      <Topbar
        title={note.title}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/notes"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <NoteActions noteId={note.id} />
          </div>
        }
      />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto">
        <NoteDetail note={note} tags={tags} />
      </div>
    </div>
  )
}
