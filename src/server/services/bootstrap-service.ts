import { prisma } from "@/lib/prisma"

export async function getBootstrapSummary(userId: string) {
  const [inboxCount, taskCounts, tagCount, noteCount] = await Promise.all([
    prisma.inboxItem.count({
      where: { userId, processedAt: null },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { userId, status: { not: "ARCHIVED" } },
      _count: { _all: true },
    }),
    prisma.tag.count({ where: { userId } }),
    prisma.note.count({ where: { userId, archivedAt: null } }),
  ])

  return {
    inboxCount,
    tagCount,
    noteCount,
    taskCounts: Object.fromEntries(taskCounts.map((item) => [item.status, item._count._all])),
  }
}
