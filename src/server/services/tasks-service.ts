import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { badRequest, notFound } from "@/server/errors"
import { taskInclude, validateUserTagIds } from "@/server/services/common"
import { zonedFilterRange } from "@/server/time"

export async function listTasks(
  userId: string,
  input: {
    status?: string | null
    due?: "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH" | null
    query?: string | null
    includeArchived?: boolean
    timezone?: string
  },
) {
  const where: Prisma.TaskWhereInput = {
    userId,
    ...(input.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
  }

  if (input.status && input.status !== "ALL") {
    where.status = input.status as never
  }

  if (input.query) {
    where.OR = [
      { title: { contains: input.query, mode: "insensitive" } },
      { description: { contains: input.query, mode: "insensitive" } },
    ]
  }

  if (input.due && input.due !== "ALL") {
    const range = zonedFilterRange(input.timezone ?? "UTC", input.due)
    where.dueAt = {
      gte: range.start,
      lt: range.end,
    }
  }

  return prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  })
}

export async function getTask(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: taskInclude,
  })
  if (!task) {
    throw notFound("Task not found", "task_not_found")
  }
  return task
}

export async function createTask(
  userId: string,
  input: {
    title: string
    description?: string | null
    status: "INBOX" | "TODO" | "DOING" | "DONE" | "ARCHIVED"
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    dueAt?: string | null
    reminderAt?: string | null
    estimateMinutes?: number | null
    isPinned?: boolean
    tagIds?: string[]
  },
) {
  const tagIds = await validateUserTagIds(userId, input.tagIds ?? [])

  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      estimateMinutes: input.estimateMinutes ?? null,
      isPinned: input.isPinned ?? false,
      completedAt: input.status === "DONE" ? new Date() : null,
      taskTags: tagIds.length
        ? {
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
    include: taskInclude,
  })
}

export async function updateTask(
  userId: string,
  id: string,
  input: {
    title?: string
    description?: string | null
    status?: "INBOX" | "TODO" | "DOING" | "DONE" | "ARCHIVED"
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    dueAt?: string | null
    reminderAt?: string | null
    estimateMinutes?: number | null
    isPinned?: boolean
    tagIds?: string[]
  },
) {
  await getTask(userId, id)
  const tagIds = input.tagIds ? await validateUserTagIds(userId, input.tagIds) : undefined

  return prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status,
            completedAt: input.status === "DONE" ? new Date() : null,
          }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      ...(input.reminderAt !== undefined ? { reminderAt: input.reminderAt ? new Date(input.reminderAt) : null } : {}),
      ...(input.estimateMinutes !== undefined ? { estimateMinutes: input.estimateMinutes ?? null } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      ...(tagIds !== undefined
        ? {
            taskTags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: taskInclude,
  })
}

export async function deleteTask(userId: string, id: string) {
  await getTask(userId, id)
  await prisma.task.delete({ where: { id } })
}

export async function cycleTaskStatus(userId: string, id: string) {
  const task = await getTask(userId, id)
  const current = task.status === "DOING" || task.status === "DONE" ? task.status : "TODO"
  const next = current === "TODO" ? "DOING" : current === "DOING" ? "DONE" : "TODO"
  return updateTask(userId, id, { status: next })
}

export async function createSubTask(userId: string, taskId: string, title: string) {
  const task = await getTask(userId, taskId)
  const sortOrder = task.subTasks.length
  return prisma.subTask.create({
    data: {
      taskId,
      title,
      sortOrder,
    },
  })
}

export async function updateSubTask(
  userId: string,
  id: string,
  input: {
    title?: string
    done?: boolean
    sortOrder?: number
  },
) {
  const subTask = await prisma.subTask.findFirst({
    where: {
      id,
      task: { userId },
    },
  })
  if (!subTask) {
    throw notFound("Subtask not found", "subtask_not_found")
  }

  return prisma.subTask.update({
    where: { id },
    data: input,
  })
}

export async function deleteSubTask(userId: string, id: string) {
  const subTask = await prisma.subTask.findFirst({
    where: {
      id,
      task: { userId },
    },
  })
  if (!subTask) {
    throw notFound("Subtask not found", "subtask_not_found")
  }
  await prisma.subTask.delete({ where: { id } })
}

export async function listTimeline(userId: string, start: string, end: string) {
  return prisma.timeBlock.findMany({
    where: {
      startAt: { lt: new Date(end) },
      endAt: { gt: new Date(start) },
      task: { userId },
    },
    include: {
      task: {
        include: {
          taskTags: { include: { tag: true } },
          subTasks: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: [{ startAt: "asc" }, { endAt: "asc" }],
  })
}

export async function createTimeBlock(
  userId: string,
  taskId: string,
  input: {
    startAt: string
    endAt: string
    isAllDay?: boolean
  },
) {
  await getTask(userId, taskId)
  const startAt = new Date(input.startAt)
  const endAt = new Date(input.endAt)
  if (endAt < startAt) {
    throw badRequest("endAt must be greater than startAt", "invalid_time_block_range")
  }

  return prisma.timeBlock.create({
    data: {
      taskId,
      startAt,
      endAt,
      isAllDay: input.isAllDay ?? false,
    },
  })
}

export async function updateTimeBlock(
  userId: string,
  id: string,
  input: {
    startAt?: string
    endAt?: string
    isAllDay?: boolean
  },
) {
  const block = await prisma.timeBlock.findFirst({
    where: {
      id,
      task: { userId },
    },
  })
  if (!block) {
    throw notFound("Time block not found", "time_block_not_found")
  }

  const startAt = input.startAt ? new Date(input.startAt) : block.startAt
  const endAt = input.endAt ? new Date(input.endAt) : block.endAt
  if (endAt < startAt) {
    throw badRequest("endAt must be greater than startAt", "invalid_time_block_range")
  }

  return prisma.timeBlock.update({
    where: { id },
    data: {
      ...(input.startAt !== undefined ? { startAt } : {}),
      ...(input.endAt !== undefined ? { endAt } : {}),
      ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
    },
  })
}

export async function deleteTimeBlock(userId: string, id: string) {
  const block = await prisma.timeBlock.findFirst({
    where: {
      id,
      task: { userId },
    },
  })
  if (!block) {
    throw notFound("Time block not found", "time_block_not_found")
  }
  await prisma.timeBlock.delete({ where: { id } })
}
