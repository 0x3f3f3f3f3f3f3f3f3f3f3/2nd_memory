import { buildFullPlannerContext } from "@/server/ai/context-builder"
import { streamNonDbChat } from "@/server/ai/chat-responder"
import { executeAiIntentPlan } from "@/server/ai/executor"
import { buildDeterministicPlan, planAiIntent } from "@/server/ai/planner"
import { classifyAiRoute } from "@/server/ai/router"
import { normalizeTimeZone } from "@/server/time"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

export type AiRouteDiagnostics = {
  routeKind: string
  timings: Record<string, number>
  usedDb: boolean
  usedExecutor: boolean
  usedFullPlanner: boolean
}

export type AiStreamResult = {
  stream: ReadableStream<Uint8Array>
  diagnostics: AiRouteDiagnostics
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

function nowMs() {
  return performance.now()
}

function mark(timings: Record<string, number>, key: string, start: number) {
  timings[key] = Math.round((nowMs() - start) * 100) / 100
}

export function toServerTimingHeader(timings: Record<string, number>) {
  return Object.entries(timings)
    .map(([key, duration]) => `${key};dur=${duration}`)
    .join(", ")
}

export async function streamAiChat(input: {
  userId: string
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: AiChatMessage[]
  onMutation?: () => void
}): Promise<AiStreamResult> {
  const timings: Record<string, number> = {}
  const totalStart = nowMs()
  const effectiveTimeZone = normalizeTimeZone(input.timeZone?.trim?.() ?? input.timeZone, "UTC")
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? ""

  const routeStart = nowMs()
  const routeDecision = classifyAiRoute(latestUserMessage)
  mark(timings, "route_classify", routeStart)

  if (routeDecision.kind === "NON_DB_CHAT") {
    const chatStart = nowMs()
    const stream = await streamNonDbChat({
      locale: input.locale,
      timeZone: effectiveTimeZone,
      messages: input.messages,
    })
    mark(timings, "chat_responder", chatStart)
    mark(timings, "total", totalStart)
    return {
      stream,
      diagnostics: {
        routeKind: routeDecision.kind,
        timings,
        usedDb: false,
        usedExecutor: false,
        usedFullPlanner: false,
      },
    }
  }

  const deterministicStart = nowMs()
  let plan = buildDeterministicPlan({
    text: latestUserMessage,
    locale: input.locale,
    timeZone: effectiveTimeZone,
    routeKind: routeDecision.kind as never,
  })
  mark(timings, "deterministic_plan", deterministicStart)

  let usedFullPlanner = false
  if (!plan || routeDecision.kind === "FULL_PLANNER") {
    const contextStart = nowMs()
    const context = await buildFullPlannerContext({
      userId: input.userId,
      utterance: latestUserMessage,
      locale: input.locale,
      timeZone: effectiveTimeZone,
    })
    mark(timings, "context_build", contextStart)

    const plannerStart = nowMs()
    plan = await planAiIntent({
      locale: input.locale,
      timeZone: effectiveTimeZone,
      messages: input.messages,
      context,
    })
    mark(timings, "planner_llm", plannerStart)
    usedFullPlanner = true
  }

  if (!plan) {
    mark(timings, "total", totalStart)
    return {
      stream: streamText(input.locale === "en" ? "I could not determine a safe action." : "我暂时无法安全判断该如何执行。"),
      diagnostics: {
        routeKind: routeDecision.kind,
        timings,
        usedDb: false,
        usedExecutor: false,
        usedFullPlanner,
      },
    }
  }

  const executorStart = nowMs()
  const result = await executeAiIntentPlan({
    userId: input.userId,
    locale: input.locale,
    timeZone: effectiveTimeZone,
    plan,
    onMutation: input.onMutation,
    stateOptions:
      routeDecision.kind === "DESTRUCTIVE_SCHEDULE"
        ? { scope: "destructive", query: latestUserMessage }
        : routeDecision.kind === "FULL_PLANNER"
        ? { scope: "full", query: latestUserMessage }
        : { scope: "tasks", query: latestUserMessage },
  })
  mark(timings, "executor", executorStart)

  const summaryStart = nowMs()
  const stream = streamText(result.userFacingSummary)
  mark(timings, "summary_build", summaryStart)
  mark(timings, "total", totalStart)

  if (process.env.NODE_ENV !== "production") {
    console.log("[ai.route]", {
      routeKind: routeDecision.kind,
      timings,
      usedFullPlanner,
    })
  }

  return {
    stream,
    diagnostics: {
      routeKind: routeDecision.kind,
      timings,
      usedDb: true,
      usedExecutor: true,
      usedFullPlanner,
    },
  }
}
