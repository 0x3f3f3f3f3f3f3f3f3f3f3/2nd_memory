"use server"
import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import {
  createSubTask as createSubTaskService,
  createTask as createTaskService,
  createTimeBlock as createTimeBlockService,
  cycleTaskStatus as cycleTaskStatusService,
  deleteSubTask as deleteSubTaskService,
  deleteTask as deleteTaskService,
  deleteTimeBlock as deleteTimeBlockService,
  updateSubTask as updateSubTaskService,
  updateTask as updateTaskService,
  updateTimeBlock as updateTimeBlockService,
} from "@/server/services/tasks-service"
import { prisma } from "@/lib/prisma"

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
  const task = await createTaskService(userId, {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    priority: parsed.priority,
    dueAt: parsed.dueAt ?? null,
    reminderAt: parsed.reminderAt ?? null,
    estimateMinutes: parsed.estimateMinutes ?? null,
    isPinned: parsed.isPinned,
    tagIds: parsed.tagIds,
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
  return task
}

export async function updateTask(id: string, data: Partial<z.infer<typeof TaskSchema>>) {
  const userId = await getCurrentUserId()
  const task = await updateTaskService(userId, id, data)
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
  return task
}

export async function deleteTask(id: string) {
  const userId = await getCurrentUserId()
  await deleteTaskService(userId, id)
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
}

export async function toggleTaskDone(id: string, done: boolean) {
  await updateTask(id, { status: done ? "DONE" : "TODO" })
  revalidatePath("/tasks")
  revalidatePath("/today")
}

export async function cycleTaskStatus(id: string, currentStatus: string) {
  const userId = await getCurrentUserId()
  const task = await cycleTaskStatusService(userId, id)
  revalidatePath("/tasks")
  revalidatePath("/today")
  return task.status
}

export async function createSubTask(taskId: string, title: string) {
  const userId = await getCurrentUserId()
  const sub = await createSubTaskService(userId, taskId, title)
  revalidatePath("/tasks")
  return sub
}

export async function toggleSubTask(id: string, done: boolean) {
  const userId = await getCurrentUserId()
  await updateSubTaskService(userId, id, { done })
  revalidatePath("/tasks")
}

export async function deleteSubTask(id: string) {
  const userId = await getCurrentUserId()
  await deleteSubTaskService(userId, id)
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

export async function createTimeBlock(taskId: string, startAt: Date, endAt: Date, subTaskId?: string | null, originTimeBlockId?: string | null) {
  const userId = await getCurrentUserId()
  const block = await createTimeBlockService(userId, taskId, {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    ...(subTaskId !== undefined ? { subTaskId } : {}),
    ...(originTimeBlockId !== undefined ? { originTimeBlockId } : {}),
  })
  revalidatePath("/timeline")
  revalidatePath("/today")
  return block
}

export async function updateTimeBlock(id: string, startAt: Date, endAt: Date, subTaskId?: string | null) {
  const userId = await getCurrentUserId()
  const block = await updateTimeBlockService(userId, id, {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    ...(subTaskId !== undefined ? { subTaskId } : {}),
  })
  revalidatePath("/timeline")
  revalidatePath("/today")
  return block
}

export async function deleteTimeBlock(id: string) {
  const userId = await getCurrentUserId()
  await deleteTimeBlockService(userId, id)
  revalidatePath("/timeline")
  revalidatePath("/today")
}

/** Assigns a task to a day (without a specific time) */
export async function createAllDayBlock(taskId: string, dateStr: string, subTaskId?: string | null, originTimeBlockId?: string | null) {
  // dateStr is "YYYY-MM-DD" in the user's local calendar
  const d = new Date(`${dateStr}T00:00:00Z`)
  const userId = await getCurrentUserId()
  const block = await createTimeBlockService(userId, taskId, {
    startAt: d.toISOString(),
    endAt: d.toISOString(),
    isAllDay: true,
    ...(subTaskId !== undefined ? { subTaskId } : {}),
    ...(originTimeBlockId !== undefined ? { originTimeBlockId } : {}),
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
