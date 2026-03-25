import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeNote } from "@/server/mobile/dtos"
import { noteUpdateSchema } from "@/server/mobile/validators"
import { deleteNote, getNote, updateNote } from "@/server/services/notes-service"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const note = await getNote(auth.user.id, id)
    return jsonData(serializeNote(note))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = noteUpdateSchema.parse(await request.json())
    const note = await updateNote(auth.user.id, id, body)
    return jsonData(serializeNote(note))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    await deleteNote(auth.user.id, id)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
