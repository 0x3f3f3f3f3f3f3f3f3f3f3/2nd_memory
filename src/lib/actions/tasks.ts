"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { z } from "zod"

const TaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: z.string().optional().nullable(),
  startAt: z.string().optional().nullable(),
  reminderAt: z.string().optional().nullable(),
  estimateMinutes: z.coerce.number().optional().nullable(),
  isPinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
})

export async function createTask(data: z.input<typeof TaskSchema>) {
  const parsed = TaskSchema.parse(data)
  const task = await prisma.task.create({
    data: {
      userId: OWNER_USER_ID,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      priority: parsed.priority,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
      startAt: parsed.startAt ? new Date(parsed.startAt) : null,
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
  const { tagIds, dueAt, startAt, reminderAt, ...rest } = data
  const task = await prisma.task.update({
    where: { id, userId: OWNER_USER_ID },
    data: {
      ...rest,
      dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : undefined,
      startAt: startAt !== undefined ? (startAt ? new Date(startAt) : null) : undefined,
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
  await prisma.task.delete({ where: { id, userId: OWNER_USER_ID } })
  revalidatePath("/tasks")
  revalidatePath("/today")
  revalidatePath("/timeline")
}

export async function toggleTaskDone(id: string, done: boolean) {
  await prisma.task.update({
    where: { id, userId: OWNER_USER_ID },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
    },
  })
  revalidatePath("/tasks")
  revalidatePath("/today")
}

export async function cycleTaskStatus(id: string, currentStatus: string) {
  const next =
    currentStatus === "TODO" ? "DOING" :
    currentStatus === "DOING" ? "DONE" : "TODO"
  await prisma.task.update({
    where: { id, userId: OWNER_USER_ID },
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
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.task.update({ where: { id, userId: OWNER_USER_ID }, data: { sortOrder: index } })
    )
  )
  revalidatePath("/tasks")
  revalidatePath("/today")
}
