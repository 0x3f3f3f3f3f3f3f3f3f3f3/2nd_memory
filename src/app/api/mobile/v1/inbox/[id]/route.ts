import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { deleteInboxItem } from "@/server/services/inbox-service"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { id } = await params
    await deleteInboxItem(auth.user.id, id)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
