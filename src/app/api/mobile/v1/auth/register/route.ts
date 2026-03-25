import { registerSchema } from "@/server/mobile/validators"
import { registerMobileUser } from "@/server/mobile/auth"
import { getStoredUserSettings, resolveEffectiveUserContext } from "@/server/preferences"
import { serializeUser, serializeUserSettings } from "@/server/mobile/dtos"
import { handleRouteError, getMobileRequestHeaders, jsonData } from "@/server/mobile/http"

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json())
    const { user, session } = await registerMobileUser(body)
    const storedSettings = await getStoredUserSettings(user.id)
    const effective = resolveEffectiveUserContext(storedSettings, getMobileRequestHeaders(request))

    return jsonData({
      token: session.token,
      user: serializeUser(user),
      settings: serializeUserSettings(effective),
      session: {
        id: session.session.id,
        deviceName: session.session.deviceName,
        expiresAt: session.session.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
