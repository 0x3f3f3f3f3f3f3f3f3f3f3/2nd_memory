import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { NoteList } from "@/components/notes/note-list"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "知识库" }

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; tag?: string }>
}) {
  const { t } = await getServerT()
  const params = await searchParams
  const { q, type, tag } = params

  const [notes, tags] = await Promise.all([
    prisma.note.findMany({
      where: {
        userId: OWNER_USER_ID,
        archivedAt: null,
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }] } : {}),
        ...(type ? { type: type as any } : {}),
        ...(tag ? { noteTags: { some: { tag: { slug: tag } } } } : {}),
      },
      include: { noteTags: { include: { tag: true } } },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="flex flex-col">
      <Topbar
        title={t.notes.pageTitle}
        actions={
          <Button size="sm" asChild>
            <Link href="/notes/new">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t.notes.newNote}</span>
            </Link>
          </Button>
        }
      />
      <div className="flex-1 p-4 md:p-6">
        <NoteList notes={notes} tags={tags} />
      </div>
    </div>
  )
}
