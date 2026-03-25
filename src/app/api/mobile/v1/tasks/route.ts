import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTask } from "@/server/mobile/dtos"
import { taskWriteSchema } from "@/server/mobile/validators"
import { createTask, listTasks } from "@/server/services/tasks-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const context = await buildAuthenticatedMobileContext(request, auth)
    const { searchParams } = new URL(request.url)
    const tasks = await listTasks(auth.user.id, {
      status: searchParams.get("status"),
      due: (searchParams.get("due") as "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH" | null) ?? "ALL",
      query: searchParams.get("q"),
      timezone: context.settings.timezone,
    })
    return jsonData(tasks.map(serializeTask))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const body = taskWriteSchema.parse(await request.json())
    const task = await createTask(auth.user.id, body)
    return jsonData(serializeTask(task), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
