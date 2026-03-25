import { handleRouteError, jsonData } from "@/server/mobile/http"
import { requireMobileSession, revokeMobileSessionByToken } from "@/server/mobile/auth"

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    await revokeMobileSessionByToken(auth.rawToken)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
