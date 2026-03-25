import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"
import { badRequest } from "@/server/errors"

export const taskInclude = {
  taskTags: { include: { tag: true } },
  subTasks: { orderBy: { sortOrder: "asc" } },
  timeBlocks: { orderBy: { startAt: "asc" } },
} satisfies Prisma.TaskInclude

export const noteInclude = {
  noteTags: { include: { tag: true } },
  noteTasks: {
    include: {
      task: {
        include: {
          taskTags: { include: { tag: true } },
          subTasks: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  },
} satisfies Prisma.NoteInclude

export async function validateUserTagIds(userId: string, tagIds: string[]) {
  if (tagIds.length === 0) return []
  const tags = await prisma.tag.findMany({
    where: { userId, id: { in: tagIds } },
    select: { id: true },
  })
  if (tags.length !== tagIds.length) {
    throw badRequest("One or more tags do not belong to the current user", "invalid_tag_ids")
  }
  return tagIds
}

export async function validateUserTaskIds(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return []
  const tasks = await prisma.task.findMany({
    where: { userId, id: { in: taskIds } },
    select: { id: true },
  })
  if (tasks.length !== taskIds.length) {
    throw badRequest("One or more tasks do not belong to the current user", "invalid_task_ids")
  }
  return taskIds
}

export async function uniqueNoteSlug(userId: string, title: string) {
  const baseSlug = slugify(title) || "note"
  let slug = baseSlug
  let counter = 1
  while (await prisma.note.findUnique({ where: { userId_slug: { userId, slug } } })) {
    slug = `${baseSlug}-${counter++}`
  }
  return slug
}

export async function uniqueTagSlug(userId: string, name: string) {
  const baseSlug = slugify(name) || `tag-${Date.now()}`
  let slug = baseSlug
  let counter = 1
  while (await prisma.tag.findUnique({ where: { userId_slug: { userId, slug } } })) {
    slug = `${baseSlug}-${counter++}`
  }
  return slug
}
