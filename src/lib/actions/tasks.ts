"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"

const TaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: z.string().optional().nullable(),
  reminderAt: z.string().optional().nullable(),
  estimateMinutes: z.coerce.number().optional().nullable(),
  isPinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
})

export async function createTask(data: z.input<typeof TaskSchema>) {
  const userId = await getCurrentUserId()
  const parsed = TaskSchema.parse(data)
  const task = await prisma.task.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      priority: parsed.priority,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
      reminderAt: parsed.reminderAt ? new Date(parsed.reminderAt) : null,
      estimateMinutes: parsed.estimateMinutes ?? null,
      isPinned: parsed.isPinned,
      taskTags: parsed.tagIds.length > 0 ? {
        create: parsed.tagIds.map((tagId) => ({ tagId })),
      } : undefined,
    },
    include: { taskTags: { include: { tag: true } }, subTasks: true },
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
  return task
}

export async function updateTask(id: string, data: Partial<z.infer<typeof TaskSchema>>) {
  const userId = await getCurrentUserId()
  const { tagIds, dueAt, reminderAt, ...rest } = data
  const task = await prisma.task.update({
    where: { id, userId },
    data: {
      ...rest,
      dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : undefined,
      reminderAt: reminderAt !== undefined ? (reminderAt ? new Date(reminderAt) : null) : undefined,
      completedAt: rest.status === "DONE" ? new Date() : rest.status ? null : undefined,
      ...(tagIds !== undefined && {
        taskTags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      }),
    },
    include: { taskTags: { include: { tag: true } }, subTasks: true },
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
  return task
}

export async function deleteTask(id: string) {
  const userId = await getCurrentUserId()
  await prisma.task.delete({ where: { id, userId } })
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
}

export async function toggleTaskDone(id: string, done: boolean) {
  const userId = await getCurrentUserId()
  await prisma.task.update({
    where: { id, userId },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
    },
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
}

export async function cycleTaskStatus(id: string, currentStatus: string) {
  const userId = await getCurrentUserId()
  const next =
    currentStatus === "TODO" ? "DOING" :
    currentStatus === "DOING" ? "DONE" : "TODO"
  await prisma.task.update({
    where: { id, userId },
    data: {
      status: next,
      completedAt: next === "DONE" ? new Date() : null,
    },
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
  return next
}

export async function createSubTask(taskId: string, title: string) {
  const sub = await prisma.subTask.create({
    data: { taskId, title, done: false },
  })
  revalidatePath("/tasks")
  return sub
}

export async function toggleSubTask(id: string, done: boolean) {
  await prisma.subTask.update({ where: { id }, data: { done } })
  revalidatePath("/tasks")
}

export async function deleteSubTask(id: string) {
  await prisma.subTask.delete({ where: { id } })
  revalidatePath("/tasks")
}

export async function reorderTasks(orderedIds: string[]) {
  const userId = await getCurrentUserId()
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.task.update({ where: { id, userId }, data: { sortOrder: index } })
    )
  )
  revalidatePath("/tasks")
  revalidatePath("/today")
}

/* ── TimeBlock CRUD ── */

export async function createTimeBlock(taskId: string, startAt: Date, endAt: Date) {
  const block = await prisma.timeBlock.create({
    data: { taskId, startAt, endAt },
  })
  revalidatePath("/timeline")
  revalidatePath("/today")
  return block
}

export async function updateTimeBlock(id: string, startAt: Date, endAt: Date) {
  const block = await prisma.timeBlock.update({
    where: { id },
    data: { startAt, endAt },
  })
  revalidatePath("/timeline")
  revalidatePath("/today")
  return block
}

export async function deleteTimeBlock(id: string) {
  await prisma.timeBlock.delete({ where: { id } })
  revalidatePath("/timeline")
  revalidatePath("/today")
}

/** Assigns a task to a day (without a specific time) */
export async function createAllDayBlock(taskId: string, dateStr: string) {
  // dateStr is "YYYY-MM-DD" in the user's local calendar
  const d = new Date(`${dateStr}T00:00:00Z`)
  const block = await prisma.timeBlock.create({
    data: { taskId, startAt: d, endAt: d, isAllDay: true },
  })
  revalidatePath("/timeline")
  revalidatePath("/today")
  return block
}

/** Removes all time blocks for a task on a given day */
export async function deleteTimeBlocksByIds(ids: string[]) {
  if (ids.length === 0) return
  await prisma.timeBlock.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/timeline")
  revalidatePath("/today")
}
