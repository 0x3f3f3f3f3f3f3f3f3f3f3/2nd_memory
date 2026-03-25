import { prisma } from "@/lib/prisma"
import { notFound } from "@/server/errors"
import { noteInclude, uniqueNoteSlug, validateUserTagIds, validateUserTaskIds } from "@/server/services/common"

export async function listNotes(
  userId: string,
  input: {
    query?: string | null
    type?: string | null
    tag?: string | null
  },
) {
  return prisma.note.findMany({
    where: {
      userId,
      archivedAt: null,
      ...(input.query
        ? {
            OR: [
              { title: { contains: input.query, mode: "insensitive" } },
              { summary: { contains: input.query, mode: "insensitive" } },
              { contentMd: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(input.type ? { type: input.type as never } : {}),
      ...(input.tag
        ? {
            noteTags: {
              some: {
                OR: [{ tagId: input.tag }, { tag: { slug: input.tag } }],
              },
            },
          }
        : {}),
    },
    include: noteInclude,
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  })
}

export async function getNote(userId: string, id: string) {
  const note = await prisma.note.findFirst({
    where: { id, userId },
    include: noteInclude,
  })
  if (!note) {
    throw notFound("Note not found", "note_not_found")
  }
  return note
}

export async function createNote(
  userId: string,
  input: {
    title: string
    summary: string
    contentMd: string
    type: "ADVICE" | "DECISION" | "PERSON" | "LESSON" | "HEALTH" | "FINANCE" | "OTHER"
    importance: "LOW" | "MEDIUM" | "HIGH"
    isPinned: boolean
    tagIds?: string[]
    relatedTaskIds?: string[]
  },
) {
  const [tagIds, relatedTaskIds, slug] = await Promise.all([
    validateUserTagIds(userId, input.tagIds ?? []),
    validateUserTaskIds(userId, input.relatedTaskIds ?? []),
    uniqueNoteSlug(userId, input.title),
  ])

  return prisma.note.create({
    data: {
      userId,
      title: input.title,
      slug,
      summary: input.summary,
      contentMd: input.contentMd,
      type: input.type,
      importance: input.importance,
      isPinned: input.isPinned,
      noteTags: tagIds.length
        ? {
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
      noteTasks: relatedTaskIds.length
        ? {
            create: relatedTaskIds.map((taskId) => ({ taskId })),
          }
        : undefined,
    },
    include: noteInclude,
  })
}

export async function updateNote(
  userId: string,
  id: string,
  input: {
    title?: string
    summary?: string
    contentMd?: string
    type?: "ADVICE" | "DECISION" | "PERSON" | "LESSON" | "HEALTH" | "FINANCE" | "OTHER"
    importance?: "LOW" | "MEDIUM" | "HIGH"
    isPinned?: boolean
    tagIds?: string[]
    relatedTaskIds?: string[]
  },
) {
  const existing = await getNote(userId, id)
  const [tagIds, relatedTaskIds, slug] = await Promise.all([
    input.tagIds ? validateUserTagIds(userId, input.tagIds) : Promise.resolve(undefined),
    input.relatedTaskIds ? validateUserTaskIds(userId, input.relatedTaskIds) : Promise.resolve(undefined),
    input.title && input.title !== existing.title ? uniqueNoteSlug(userId, input.title) : Promise.resolve(existing.slug),
  ])

  return prisma.note.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title, slug } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.contentMd !== undefined ? { contentMd: input.contentMd } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.importance !== undefined ? { importance: input.importance } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      ...(tagIds !== undefined
        ? {
            noteTags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
      ...(relatedTaskIds !== undefined
        ? {
            noteTasks: {
              deleteMany: {},
              create: relatedTaskIds.map((taskId) => ({ taskId })),
            },
          }
        : {}),
    },
    include: noteInclude,
  })
}

export async function deleteNote(userId: string, id: string) {
  await getNote(userId, id)
  await prisma.note.delete({ where: { id } })
}
