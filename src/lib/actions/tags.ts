"use server"
import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import {
  createTag as createTagService,
  deleteTag as deleteTagService,
  updateTag as updateTagService,
} from "@/server/services/tags-service"

const TagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().default("#6366f1"),
  icon: z.string().optional(),
  description: z.string().optional(),
})

export async function createTag(data: z.infer<typeof TagSchema>) {
  const userId = await getCurrentUserId()
  const parsed = TagSchema.parse(data)
  const tag = await createTagService(userId, parsed)
  revalidatePath("/tags")
  return tag
}

export async function updateTag(id: string, data: Partial<z.infer<typeof TagSchema>>) {
  const userId = await getCurrentUserId()
  const tag = await updateTagService(userId, id, data)
  revalidatePath("/tags")
  revalidatePath(`/tags/${tag.slug}`)
  return tag
}

export async function deleteTag(id: string) {
  const userId = await getCurrentUserId()
  await deleteTagService(userId, id)
  revalidatePath("/tags")
}
