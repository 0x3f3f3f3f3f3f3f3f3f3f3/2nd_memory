import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeInboxItem } from "@/server/mobile/dtos"
import { inboxCreateSchema } from "@/server/mobile/validators"
import { createInboxItem, listInboxItems } from "@/server/services/inbox-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const items = await listInboxItems(auth.user.id)
    return jsonData(items.map(serializeInboxItem))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const body = inboxCreateSchema.parse(await request.json())
    const item = await createInboxItem(auth.user.id, body.content)
    return jsonData(serializeInboxItem(item), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
