import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { NoteForm } from "@/components/notes/note-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "新建笔记" }

export default async function NewNotePage() {
  const tags = await prisma.tag.findMany({ where: { userId: OWNER_USER_ID }, orderBy: { sortOrder: "asc" } })

  return (
    <div className="flex flex-col">
      <Topbar
        title="新建笔记"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/notes"><ArrowLeft className="w-4 h-4" />返回</Link>
          </Button>
        }
      />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto">
        <NoteForm tags={tags} />
      </div>
    </div>
  )
}
