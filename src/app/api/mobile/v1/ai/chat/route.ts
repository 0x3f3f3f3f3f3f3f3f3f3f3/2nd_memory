import { aiChatSchema } from "@/server/mobile/validators"
import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError } from "@/server/mobile/http"
import { streamAiChat } from "@/server/services/ai-chat-service"

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const context = await buildAuthenticatedMobileContext(request, auth)
    const body = aiChatSchema.parse(await request.json())
    // iOS appends an empty assistant placeholder before sending; strip it
    const messages = body.messages.filter((m) => m.content.trim().length > 0)
    if (messages.length === 0) {
      return new Response("No messages", { status: 400 })
    }
    const stream = await streamAiChat({
      userId: auth.user.id,
      locale: body.locale ?? context.settings.language,
      timeZone: body.timezone ?? context.settings.timezone,
      messages,
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
