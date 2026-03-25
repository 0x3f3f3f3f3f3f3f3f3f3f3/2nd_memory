"use server"
import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import {
  createInboxItem,
  deleteInboxItem as deleteInboxItemService,
  processInboxItem as processInboxItemService,
} from "@/server/services/inbox-service"

export async function addToInbox(content: string) {
  const userId = await getCurrentUserId()
  const item = await createInboxItem(userId, content)
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
  await processInboxItemService(userId, id, processType, extra?.title)

  revalidatePath("/inbox")
  revalidatePath("/tasks")
  revalidatePath("/notes")
  revalidatePath("/today")
}

export async function deleteInboxItem(id: string) {
  const userId = await getCurrentUserId()
  await deleteInboxItemService(userId, id)
  revalidatePath("/inbox")
}
