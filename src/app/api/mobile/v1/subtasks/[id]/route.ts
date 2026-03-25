import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeSubTask } from "@/server/mobile/dtos"
import { subTaskUpdateSchema } from "@/server/mobile/validators"
import { deleteSubTask, updateSubTask } from "@/server/services/tasks-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = subTaskUpdateSchema.parse(await request.json())
    const subTask = await updateSubTask(auth.user.id, id, body)
    return jsonData(serializeSubTask(subTask))
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
    await deleteSubTask(auth.user.id, id)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
