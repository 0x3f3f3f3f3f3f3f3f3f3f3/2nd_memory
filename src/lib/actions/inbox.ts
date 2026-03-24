"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { slugify } from "@/lib/utils"

export async function addToInbox(content: string) {
  const userId = await getCurrentUserId()
  const item = await prisma.inboxItem.create({
    data: { userId, content },
  })
  revalidatePath("/inbox")
  revalidatePath("/today")
  return item
}

export async function processInboxItem(
  id: string,
  processType: "TASK" | "NOTE" | "BOTH",
  extra?: { title?: string }
) {
  const userId = await getCurrentUserId()
  const item = await prisma.inboxItem.findUnique({ where: { id } })
  if (!item) return

  const title = extra?.title || item.content.slice(0, 100)

  if (processType === "TASK" || processType === "BOTH") {
    await prisma.task.create({
      data: { userId, title, description: item.content, status: "TODO" },
    })
  }

  if (processType === "NOTE" || processType === "BOTH") {
    const baseSlug = slugify(title) || "note"
    let slug = baseSlug
    let counter = 1
    while (await prisma.note.findUnique({ where: { userId_slug: { userId, slug } } })) {
      slug = `${baseSlug}-${counter++}`
    }
    await prisma.note.create({
      data: {
        userId,
        title,
        slug,
        contentMd: item.content,
      },
    })
  }

  await prisma.inboxItem.update({
    where: { id },
    data: { processedAt: new Date(), processType },
  })

  revalidatePath("/inbox")
  revalidatePath("/tasks")
  revalidatePath("/notes")
  revalidatePath("/today")
}

export async function deleteInboxItem(id: string) {
  await prisma.inboxItem.delete({ where: { id } })
  revalidatePath("/inbox")
}
