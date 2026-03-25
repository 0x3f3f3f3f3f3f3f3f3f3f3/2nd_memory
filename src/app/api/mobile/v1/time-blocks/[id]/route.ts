import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTimeBlock } from "@/server/mobile/dtos"
import { timeBlockUpdateSchema } from "@/server/mobile/validators"
import { deleteTimeBlock, updateTimeBlock } from "@/server/services/tasks-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = timeBlockUpdateSchema.parse(await request.json())
    const block = await updateTimeBlock(auth.user.id, id, body)
    return jsonData(serializeTimeBlock(block))
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
    await deleteTimeBlock(auth.user.id, id)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
