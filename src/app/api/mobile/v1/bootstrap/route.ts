import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeUser, serializeUserSettings } from "@/server/mobile/dtos"
import { getBootstrapSummary } from "@/server/services/bootstrap-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const context = await buildAuthenticatedMobileContext(request, auth)
    const summary = await getBootstrapSummary(context.user.id)

    return jsonData({
      user: serializeUser(context.user),
      settings: serializeUserSettings(context.settings),
      summary,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
