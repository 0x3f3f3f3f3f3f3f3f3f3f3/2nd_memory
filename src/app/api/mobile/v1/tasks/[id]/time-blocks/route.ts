import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTimeBlock } from "@/server/mobile/dtos"
import { timeBlockCreateSchema } from "@/server/mobile/validators"
import { createTimeBlock } from "@/server/services/tasks-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = timeBlockCreateSchema.parse(await request.json())
    const block = await createTimeBlock(auth.user.id, id, body)
    return jsonData(serializeTimeBlock(block), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
