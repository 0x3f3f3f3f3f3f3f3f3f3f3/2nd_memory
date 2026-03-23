"use server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { z } from "zod"
import { slugify, calcNextReview } from "@/lib/utils"
import { addDays } from "date-fns"

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
  const parsed = NoteSchema.parse(data)
  const baseSlug = slugify(parsed.title) || "note"
  let slug = baseSlug
  let counter = 1
  while (await prisma.note.findUnique({ where: { userId_slug: { userId: OWNER_USER_ID, slug } } })) {
    slug = `${baseSlug}-${counter++}`
  }

  const note = await prisma.note.create({
    data: {
      userId: OWNER_USER_ID,
      title: parsed.title,
      slug,
      summary: parsed.summary,
      contentMd: parsed.contentMd,
      type: parsed.type,
      importance: parsed.importance,
      isPinned: parsed.isPinned,
      nextReviewAt: addDays(new Date(), 1),
      reviewIntervalDays: 1,
      noteTags: parsed.tagIds.length > 0 ? {
        create: parsed.tagIds.map((tagId) => ({ tagId })),
      } : undefined,
    },
    include: { noteTags: { include: { tag: true } } },
  })
  revalidatePath("/notes")
  revalidatePath("/review")
  return note
}

export async function updateNote(id: string, data: Partial<z.input<typeof NoteSchema>>) {
  const { tagIds, ...rest } = data
  const note = await prisma.note.update({
    where: { id, userId: OWNER_USER_ID },
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
  await prisma.note.delete({ where: { id, userId: OWNER_USER_ID } })
  revalidatePath("/notes")
  revalidatePath("/review")
}

export async function reviewNote(noteId: string, rating: "FORGOT" | "VAGUE" | "REMEMBERED" | "EASY") {
  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note) return

  const nextReviewAt = calcNextReview(rating, note.reviewIntervalDays)
  const intervalDays = Math.round((nextReviewAt.getTime() - Date.now()) / 86400000)

  await prisma.$transaction([
    prisma.reviewLog.create({
      data: {
        noteId,
        rating,
        prevNextReviewAt: note.nextReviewAt,
        nextNextReviewAt: nextReviewAt,
      },
    }),
    prisma.note.update({
      where: { id: noteId },
      data: {
        lastReviewedAt: new Date(),
        nextReviewAt,
        reviewIntervalDays: intervalDays,
      },
    }),
  ])
  revalidatePath("/review")
  revalidatePath(`/notes/${noteId}`)
}
