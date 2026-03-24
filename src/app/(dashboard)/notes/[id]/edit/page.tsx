import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { NoteForm } from "@/components/notes/note-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const note = await prisma.note.findUnique({ where: { id, userId } })
  return { title: note ? `编辑 · ${note.title}` : "编辑笔记" }
}

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const note = await prisma.note.findUnique({
    where: { id, userId },
    include: { noteTags: { include: { tag: true } } },
  })
  if (!note) notFound()

  const tags = await prisma.tag.findMany({ where: { userId: userId }, orderBy: { sortOrder: "asc" } })

  return (
    <div className="flex flex-col">
      <Topbar
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/notes/${id}`}><ArrowLeft className="w-4 h-4 mr-1" />返回</Link>
          </Button>
        }
      />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto">
        <NoteForm note={note} tags={tags} />
      </div>
    </div>
  )
}
