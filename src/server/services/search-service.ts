import { prisma } from "@/lib/prisma"
import { taskInclude, noteInclude } from "@/server/services/common"

export async function searchEverything(userId: string, query: string) {
  if (!query.trim()) {
    return { tasks: [], notes: [], tags: [] }
  }

  const [tasks, notes, tags] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "ARCHIVED" },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      include: taskInclude,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.note.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
          { contentMd: { contains: query, mode: "insensitive" } },
        ],
      },
      include: noteInclude,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prisma.tag.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        _count: {
          select: {
            taskTags: true,
            noteTags: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 20,
    }),
  ])

  return { tasks, notes, tags }
}
