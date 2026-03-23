import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { SearchResults } from "@/components/shared/search-results"

export const metadata = { title: "搜索" }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  const [tasks, notes, tags] = q
    ? await Promise.all([
        prisma.task.findMany({
          where: { userId: OWNER_USER_ID, title: { contains: q, mode: "insensitive" }, status: { not: "ARCHIVED" } },
          include: { taskTags: { include: { tag: true } }, subTasks: true },
          take: 10,
        }),
        prisma.note.findMany({
          where: {
            userId: OWNER_USER_ID,
            archivedAt: null,
            OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { contentMd: { contains: q, mode: "insensitive" } }],
          },
          include: { noteTags: { include: { tag: true } } },
          take: 10,
        }),
        prisma.tag.findMany({
          where: { userId: OWNER_USER_ID, name: { contains: q, mode: "insensitive" } },
          take: 10,
        }),
      ])
    : [[], [], []]

  return (
    <div className="flex flex-col">
      <Topbar title="搜索" />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto">
        <SearchResults tasks={tasks} notes={notes} tags={tags} query={q ?? ""} />
      </div>
    </div>
  )
}
