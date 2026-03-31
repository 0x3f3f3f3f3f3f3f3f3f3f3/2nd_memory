import { aiChatSchema } from "@/server/mobile/validators"
import { buildAuthenticatedMobileContext, requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError } from "@/server/mobile/http"
import { streamAiChat, toServerTimingHeader } from "@/server/services/ai-chat-service"
import type { AiExecutionMutation } from "@/server/ai/contracts"

function impactedFeatures(mutation: AiExecutionMutation) {
  switch (mutation.type) {
    case "task_created":
    case "task_updated":
      return ["tasks"]
    case "time_block_created":
    case "time_block_reused":
    case "time_block_updated":
    case "time_block_deleted":
      return ["tasks", "timeline"]
    case "note_created":
    case "note_updated":
    case "note_linked":
      return ["notes"]
    case "inbox_captured":
      return ["inbox"]
    case "future_time_blocks_cleared":
      return ["timeline"]
    case "tasks_deleted":
      return ["tasks", "timeline"]
    default:
      return []
  }
}

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
    const result = await streamAiChat({
      userId: auth.user.id,
      locale: body.locale ?? context.settings.language,
      timeZone: body.timezone ?? context.settings.timezone,
      messages,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const ndjson = new ReadableStream({
      async start(controller) {
        const reader = result.stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value, { stream: true })
            if (text.length > 0) {
              controller.enqueue(encoder.encode(`${JSON.stringify({
                type: "token",
                delta: text,
              })}\n`))
            }
          }

          for (const mutation of result.mutations) {
            controller.enqueue(encoder.encode(`${JSON.stringify({
              type: "mutation",
              mutationKind: mutation.type,
              features: impactedFeatures(mutation),
            })}\n`))
          }

          controller.enqueue(encoder.encode(`${JSON.stringify({
            type: "complete",
            summary: result.summaryText,
          })}\n`))
          controller.close()
        } catch (error) {
          controller.enqueue(encoder.encode(`${JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          })}\n`))
          controller.close()
        }
      },
    })

    return new Response(ndjson, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        "Server-Timing": toServerTimingHeader(result.diagnostics.timings),
        "X-AI-Route-Kind": result.diagnostics.routeKind,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
