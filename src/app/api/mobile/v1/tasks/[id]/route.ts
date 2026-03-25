import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTask } from "@/server/mobile/dtos"
import { taskUpdateSchema } from "@/server/mobile/validators"
import { deleteTask, getTask, updateTask } from "@/server/services/tasks-service"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const task = await getTask(auth.user.id, id)
    return jsonData(serializeTask(task))
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
    const body = taskUpdateSchema.parse(await request.json())
    const task = await updateTask(auth.user.id, id, body)
    return jsonData(serializeTask(task))
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
    await deleteTask(auth.user.id, id)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
