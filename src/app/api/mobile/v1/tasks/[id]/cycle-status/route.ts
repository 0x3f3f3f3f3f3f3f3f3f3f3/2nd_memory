import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTask } from "@/server/mobile/dtos"
import { cycleTaskStatus } from "@/server/services/tasks-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const task = await cycleTaskStatus(auth.user.id, id)
    return jsonData(serializeTask(task))
  } catch (error) {
    return handleRouteError(error)
  }
}
