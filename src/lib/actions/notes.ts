"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import { slugify } from "@/lib/utils"

const NoteSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().default(""),
  contentMd: z.string().default(""),
  type: z.enum(["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"]).default("OTHER"),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  isPinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
})

export async function createNote(data: z.input<typeof NoteSchema>) {
  const userId = await getCurrentUserId()
  const parsed = NoteSchema.parse(data)
  const baseSlug = slugify(parsed.title) || "note"
  let slug = baseSlug
  let counter = 1
  while (await prisma.note.findUnique({ where: { userId_slug: { userId, slug } } })) {
    slug = `${baseSlug}-${counter++}`
  }

  const note = await prisma.note.create({
    data: {
      userId,
      title: parsed.title,
      slug,
      summary: parsed.summary,
      contentMd: parsed.contentMd,
      type: parsed.type,
      importance: parsed.importance,
      isPinned: parsed.isPinned,
      noteTags: parsed.tagIds.length > 0 ? {
        create: parsed.tagIds.map((tagId) => ({ tagId })),
      } : undefined,
    },
    include: { noteTags: { include: { tag: true } } },
  })
  revalidatePath("/notes")
  return note
}

export async function updateNote(id: string, data: Partial<z.input<typeof NoteSchema>>) {
  const userId = await getCurrentUserId()
  const { tagIds, ...rest } = data
  const note = await prisma.note.update({
    where: { id, userId },
    data: {
      ...rest,
      ...(tagIds !== undefined && {
        noteTags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      }),
    },
    include: { noteTags: { include: { tag: true } } },
  })
  revalidatePath("/notes")
  revalidatePath(`/notes/${id}`)
  return note
}

export async function deleteNote(id: string) {
  const userId = await getCurrentUserId()
  await prisma.note.delete({ where: { id, userId } })
  revalidatePath("/notes")
}
