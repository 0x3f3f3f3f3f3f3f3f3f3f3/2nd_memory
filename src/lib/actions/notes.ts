"use server"
import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import {
  createNote as createNoteService,
  deleteNote as deleteNoteService,
  updateNote as updateNoteService,
} from "@/server/services/notes-service"

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
  const note = await createNoteService(userId, {
    title: parsed.title,
    summary: parsed.summary,
    contentMd: parsed.contentMd,
    type: parsed.type,
    importance: parsed.importance,
    isPinned: parsed.isPinned,
    tagIds: parsed.tagIds,
  })
  revalidatePath("/notes")
  return note
}

export async function updateNote(id: string, data: Partial<z.input<typeof NoteSchema>>) {
  const userId = await getCurrentUserId()
  const note = await updateNoteService(userId, id, data)
  revalidatePath("/notes")
  revalidatePath(`/notes/${id}`)
  return note
}

export async function deleteNote(id: string) {
  const userId = await getCurrentUserId()
  await deleteNoteService(userId, id)
  revalidatePath("/notes")
}
