import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeInboxItem, serializeNote, serializeTask } from "@/server/mobile/dtos"
import { inboxProcessSchema } from "@/server/mobile/validators"
import { processInboxItem } from "@/server/services/inbox-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    const body = inboxProcessSchema.parse(await request.json())
    const result = await processInboxItem(auth.user.id, id, body.processType, body.title)

    return jsonData({
      inboxItem: serializeInboxItem(result.inboxItem),
      task: result.task ? serializeTask(result.task) : null,
      note: result.note ? serializeNote(result.note) : null,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
