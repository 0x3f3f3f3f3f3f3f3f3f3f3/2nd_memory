import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeSubTask } from "@/server/mobile/dtos"
import { subTaskCreateSchema } from "@/server/mobile/validators"
import { createSubTask } from "@/server/services/tasks-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = subTaskCreateSchema.parse(await request.json())
    const subTask = await createSubTask(auth.user.id, id, body.title)
    return jsonData(serializeSubTask(subTask), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
