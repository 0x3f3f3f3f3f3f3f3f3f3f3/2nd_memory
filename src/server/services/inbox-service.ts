import { prisma } from "@/lib/prisma"
import { badRequest, notFound } from "@/server/errors"
import { uniqueNoteSlug } from "@/server/services/common"

export async function listInboxItems(userId: string) {
  return prisma.inboxItem.findMany({
    where: { userId, processedAt: null },
    orderBy: { capturedAt: "desc" },
  })
}

export async function createInboxItem(userId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) {
    throw badRequest("Content is required", "empty_content")
  }

  return prisma.inboxItem.create({
    data: { userId, content: trimmed },
  })
}

export async function processInboxItem(
  userId: string,
  id: string,
  processType: "TASK" | "NOTE" | "BOTH",
  title?: string,
) {
  const item = await prisma.inboxItem.findFirst({
    where: { id, userId },
  })

  if (!item) {
    throw notFound("Inbox item not found", "inbox_item_not_found")
  }

  const nextTitle = (title?.trim() || item.content.slice(0, 100)).trim()
  let task = null
  let note = null

  if (processType === "TASK" || processType === "BOTH") {
    task = await prisma.task.create({
      data: {
        userId,
        title: nextTitle,
        description: item.content,
        status: "TODO",
      },
      include: {
        taskTags: { include: { tag: true } },
        subTasks: true,
        timeBlocks: true,
      },
    })
  }

  if (processType === "NOTE" || processType === "BOTH") {
    const slug = await uniqueNoteSlug(userId, nextTitle)
    note = await prisma.note.create({
      data: {
        userId,
        title: nextTitle,
        slug,
        contentMd: item.content,
      },
      include: {
        noteTags: { include: { tag: true } },
        noteTasks: { include: { task: true } },
      },
    })
  }

  const inboxItem = await prisma.inboxItem.update({
    where: { id },
    data: {
      processedAt: new Date(),
      processType,
    },
  })

  return { inboxItem, task, note }
}

export async function deleteInboxItem(userId: string, id: string) {
  const item = await prisma.inboxItem.findFirst({ where: { id, userId } })
  if (!item) {
    throw notFound("Inbox item not found", "inbox_item_not_found")
  }
  await prisma.inboxItem.delete({ where: { id } })
}
