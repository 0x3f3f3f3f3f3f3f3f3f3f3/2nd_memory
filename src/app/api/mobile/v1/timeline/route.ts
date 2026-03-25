import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTask, serializeTimeBlock } from "@/server/mobile/dtos"
import { listTimeline } from "@/server/services/tasks-service"
import { badRequest } from "@/server/errors"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    if (!start || !end) {
      throw badRequest("start and end are required", "missing_timeline_range")
    }

    const blocks = await listTimeline(auth.user.id, start, end)
    return jsonData(
      blocks.map((block) => ({
        ...serializeTimeBlock(block),
        task: serializeTask({
          ...block.task,
          timeBlocks: [],
        }),
      })),
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
