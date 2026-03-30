import { buildAiPlannerContext } from "@/server/ai/context-builder"
import { executeAiIntentPlan } from "@/server/ai/executor"
import { planAiIntent } from "@/server/ai/planner"
import { normalizeTimeZone } from "@/server/time"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

function streamText(text: string) {
  const encoder = new TextEncoder()
  const chunks = text.match(/.{1,16}/g) ?? [text]
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

export async function streamAiChat(input: {
  userId: string
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: AiChatMessage[]
  onMutation?: () => void
}) {
  const effectiveTimeZone = normalizeTimeZone(input.timeZone?.trim?.() ?? input.timeZone, "UTC")
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? ""

  const context = await buildAiPlannerContext({
    userId: input.userId,
    utterance: latestUserMessage,
    locale: input.locale,
    timeZone: effectiveTimeZone,
  })

  const plan = await planAiIntent({
    locale: input.locale,
    timeZone: effectiveTimeZone,
    messages: input.messages,
    context,
  })

  const result = await executeAiIntentPlan({
    userId: input.userId,
    locale: input.locale,
    plan,
    onMutation: input.onMutation,
  })

  return streamText(result.userFacingSummary)
}
