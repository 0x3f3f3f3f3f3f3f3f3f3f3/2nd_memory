import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeUser, serializeUserSettings } from "@/server/mobile/dtos"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const context = await buildAuthenticatedMobileContext(request, auth)
    return jsonData({
      user: serializeUser(context.user),
      settings: serializeUserSettings(context.settings),
      session: {
        id: context.session.id,
        deviceName: context.session.deviceName,
        expiresAt: context.session.expiresAt.toISOString(),
        lastUsedAt: context.session.lastUsedAt.toISOString(),
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
