import { prisma } from "@/lib/prisma"
import { searchEverything } from "@/server/services/search-service"
import { deriveSearchQueries } from "@/server/ai/normalization"
import { AiPlannerContext } from "@/server/ai/contracts"
import { zonedDayRange } from "@/server/time"
import { addDays } from "date-fns"

export async function buildAiPlannerContext(input: {
  userId: string
  utterance: string
  locale: "zh-Hans" | "en"
  timeZone: string
}): Promise<AiPlannerContext> {
  const searchQueries = deriveSearchQueries(input.utterance)
  const { start } = zonedDayRange(input.timeZone)
  const horizonEnd = addDays(start, 7)

  const [tasks, notes, tags, timeBlocks, searches] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: input.userId,
        status: { not: "ARCHIVED" },
      },
      include: {
        subTasks: { orderBy: { sortOrder: "asc" } },
        timeBlocks: {
          where: {
            startAt: { lt: horizonEnd },
            endAt: { gt: addDays(start, -7) },
          },
          orderBy: { startAt: "asc" },
        },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { updatedAt: "desc" }],
      take: 80,
    }),
    prisma.note.findMany({
      where: { userId: input.userId, archivedAt: null },
      include: {
        noteTasks: { include: { task: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.tag.findMany({
      where: { userId: input.userId },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.timeBlock.findMany({
      where: {
        task: { userId: input.userId },
        startAt: { lt: horizonEnd },
        endAt: { gt: addDays(start, -7) },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startAt: "asc" },
      take: 80,
    }),
    Promise.all(searchQueries.slice(0, 3).map(async (query) => {
      const result = await searchEverything(input.userId, query)
      return {
        query,
        tasks: result.tasks.slice(0, 5).map((task) => ({ id: task.id, title: task.title, status: task.status })),
        notes: result.notes.slice(0, 5).map((note) => ({ id: note.id, title: note.title })),
        tags: result.tags.slice(0, 5).map((tag) => ({ id: tag.id, name: tag.name })),
      }
    })),
  ])

  return {
    nowIso: new Date().toISOString(),
    locale: input.locale,
    timeZone: input.timeZone,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      reminderAt: task.reminderAt?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
      subTaskCount: task.subTasks.length,
      timeBlockCount: task.timeBlocks.length,
    })),
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary,
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    searchResults: searches,
  }
}
