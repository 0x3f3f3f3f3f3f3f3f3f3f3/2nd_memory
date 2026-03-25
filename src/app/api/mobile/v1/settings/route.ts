import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeUserSettings } from "@/server/mobile/dtos"
import { settingsUpdateSchema } from "@/server/mobile/validators"
import { updateUserSettings } from "@/server/services/settings-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const context = await buildAuthenticatedMobileContext(request, auth)
    return jsonData(serializeUserSettings(context.settings))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const body = settingsUpdateSchema.parse(await request.json())
    await updateUserSettings(auth.user.id, body)
    const context = await buildAuthenticatedMobileContext(request, auth)
    return jsonData(serializeUserSettings(context.settings))
  } catch (error) {
    return handleRouteError(error)
  }
}
