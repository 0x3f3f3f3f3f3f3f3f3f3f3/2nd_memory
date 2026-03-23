"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { z } from "zod"
import { slugify } from "@/lib/utils"

const TagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().default("#6366f1"),
  icon: z.string().optional(),
  description: z.string().optional(),
})

export async function createTag(data: z.infer<typeof TagSchema>) {
  const parsed = TagSchema.parse(data)
  const slug = slugify(parsed.name) || `tag-${Date.now()}`
  const tag = await prisma.tag.create({
    data: { userId: OWNER_USER_ID, ...parsed, slug },
  })
  revalidatePath("/tags")
  return tag
}

export async function updateTag(id: string, data: Partial<z.infer<typeof TagSchema>>) {
  const tag = await prisma.tag.update({
    where: { id, userId: OWNER_USER_ID },
    data,
  })
  revalidatePath("/tags")
  revalidatePath(`/tags/${tag.slug}`)
  return tag
}

export async function deleteTag(id: string) {
  await prisma.tag.delete({ where: { id, userId: OWNER_USER_ID } })
  revalidatePath("/tags")
}
