import { prisma } from "@/lib/prisma"
import type { AiPlannerContext } from "@/server/ai/contracts"
import { deriveSearchQueries, normalizeTitleForMatch } from "@/server/ai/normalization"
import { searchEverythingLite } from "@/server/services/search-service"
import { zonedDayRange } from "@/server/time"
import { addDays } from "date-fns"

export function buildLiteContext(input: {
  locale: "zh-Hans" | "en"
  timeZone: string
}): AiPlannerContext {
  return {
    nowIso: new Date().toISOString(),
    locale: input.locale,
    timeZone: input.timeZone,
    tasks: [],
    notes: [],
    tags: [],
    searchResults: [],
  }
}

export async function buildScopedTaskContext(input: {
  userId: string
  utterance: string
  locale: "zh-Hans" | "en"
  timeZone: string
}): Promise<AiPlannerContext> {
  const query = deriveSearchQueries(input.utterance)[0] ?? input.utterance.trim()
  const normalized = normalizeTitleForMatch(query)
  const tasks = await prisma.task.findMany({
    where: {
      userId: input.userId,
      status: { not: "ARCHIVED" },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      reminderAt: true,
      updatedAt: true,
      _count: {
        select: {
          subTasks: true,
          timeBlocks: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  })
  const lite = await searchEverythingLite(input.userId, query)

  return {
    nowIso: new Date().toISOString(),
    locale: input.locale,
    timeZone: input.timeZone,
    tasks: tasks
      .filter((task) => {
        const title = normalizeTitleForMatch(task.title)
        return !normalized || title.includes(normalized) || normalized.includes(title)
      })
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString() ?? null,
        reminderAt: task.reminderAt?.toISOString() ?? null,
        updatedAt: task.updatedAt.toISOString(),
        subTaskCount: task._count.subTasks,
        timeBlockCount: task._count.timeBlocks,
      })),
    notes: [],
    tags: lite.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    searchResults: [
      {
        query,
        tasks: lite.tasks.map((task) => ({ id: task.id, title: task.title, status: task.status })),
        notes: [],
        tags: lite.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      },
    ],
  }
}

export async function buildNoteContext(input: {
  userId: string
  utterance: string
  locale: "zh-Hans" | "en"
  timeZone: string
}): Promise<AiPlannerContext> {
  const query = deriveSearchQueries(input.utterance)[0] ?? input.utterance.trim()
  const [notes, lite] = await Promise.all([
    prisma.note.findMany({
      where: {
        userId: input.userId,
        archivedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
          { contentMd: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        summary: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    searchEverythingLite(input.userId, query),
  ])

  return {
    nowIso: new Date().toISOString(),
    locale: input.locale,
    timeZone: input.timeZone,
    tasks: lite.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      reminderAt: task.reminderAt?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
      subTaskCount: 0,
      timeBlockCount: 0,
    })),
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary,
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags: lite.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    searchResults: [
      {
        query,
        tasks: lite.tasks.map((task) => ({ id: task.id, title: task.title, status: task.status })),
        notes: lite.notes.map((note) => ({ id: note.id, title: note.title })),
        tags: lite.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      },
    ],
  }
}

export async function buildDestructiveContext(input: {
  userId: string
  locale: "zh-Hans" | "en"
  timeZone: string
}): Promise<AiPlannerContext> {
  const futureCount = await prisma.timeBlock.count({
    where: {
      task: { userId: input.userId },
      startAt: { gte: new Date() },
    },
  })

  return {
    ...buildLiteContext(input),
    notes: futureCount > 0 ? [{ id: "__future_time_blocks__", title: `future:${futureCount}`, summary: "", updatedAt: new Date().toISOString() }] : [],
  }
}

export async function buildFullPlannerContext(input: {
  userId: string
  utterance: string
  locale: "zh-Hans" | "en"
  timeZone: string
}): Promise<AiPlannerContext> {
  const searchQueries = deriveSearchQueries(input.utterance).slice(0, 2)
  const { start } = zonedDayRange(input.timeZone)
  const horizonEnd = addDays(start, 7)

  const [tasks, notes, tags, searches] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: input.userId,
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        reminderAt: true,
        updatedAt: true,
        _count: {
          select: {
            subTasks: true,
            timeBlocks: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
    }),
    prisma.note.findMany({
      where: { userId: input.userId, archivedAt: null },
      select: {
        id: true,
        title: true,
        summary: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 16,
    }),
    prisma.tag.findMany({
      where: { userId: input.userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
      take: 16,
    }),
    Promise.all(searchQueries.map(async (query) => {
      const result = await searchEverythingLite(input.userId, query)
      return {
        query,
        tasks: result.tasks.slice(0, 4).map((task) => ({ id: task.id, title: task.title, status: task.status })),
        notes: result.notes.slice(0, 4).map((note) => ({ id: note.id, title: note.title })),
        tags: result.tags.slice(0, 4).map((tag) => ({ id: tag.id, name: tag.name })),
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
      subTaskCount: task._count.subTasks,
      timeBlockCount: task._count.timeBlocks,
    })),
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.summary,
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags,
    searchResults: searches,
  }
}

export const buildAiPlannerContext = buildFullPlannerContext
