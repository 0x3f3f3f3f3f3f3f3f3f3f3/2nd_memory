import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeNote } from "@/server/mobile/dtos"
import { noteWriteSchema } from "@/server/mobile/validators"
import { createNote, listNotes } from "@/server/services/notes-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const { searchParams } = new URL(request.url)
    const notes = await listNotes(auth.user.id, {
      query: searchParams.get("q"),
      type: searchParams.get("type"),
      tag: searchParams.get("tag"),
    })
    return jsonData(notes.map(serializeNote))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const body = noteWriteSchema.parse(await request.json())
    const note = await createNote(auth.user.id, body)
    return jsonData(serializeNote(note), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
