import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const buildFullPlannerContext = vi.fn()
const planAiIntent = vi.fn()
const executeAiIntentPlan = vi.fn()
const streamNonDbChat = vi.fn()
const buildDeterministicPlan = vi.fn()

vi.mock("@/server/ai/context-builder", () => ({
  buildFullPlannerContext,
}))

vi.mock("@/server/ai/planner", () => ({
  planAiIntent,
  buildDeterministicPlan,
}))

vi.mock("@/server/ai/executor", () => ({
  executeAiIntentPlan,
}))

vi.mock("@/server/ai/chat-responder", () => ({
  streamNonDbChat,
}))

describe("performance safety", () => {
  beforeEach(() => {
    vi.resetModules()
    buildFullPlannerContext.mockReset()
    planAiIntent.mockReset()
    executeAiIntentPlan.mockReset()
    streamNonDbChat.mockReset()
    buildDeterministicPlan.mockReset()
    streamNonDbChat.mockResolvedValue(new ReadableStream())
    buildDeterministicPlan.mockReturnValue({
      mode: "execute",
      intentSummary: "fast",
      confidence: 1,
      assumptions: [],
      actions: [],
      userFacingSummary: "ok",
    })
    executeAiIntentPlan.mockResolvedValue({
      plan: {
        mode: "execute",
        intentSummary: "fast",
        confidence: 1,
        assumptions: [],
        actions: [],
        userFacingSummary: "ok",
      },
      mutations: [],
      userFacingSummary: "ok",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("non-db chat does not hit DB context or executor", async () => {
    const { streamAiChat } = await import("@/server/services/ai-chat-service")
    await streamAiChat({
      userId: "owner",
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      messages: [{ role: "user", content: "解释一下什么是世界模型" }],
    })
    expect(streamNonDbChat).toHaveBeenCalled()
    expect(buildFullPlannerContext).not.toHaveBeenCalled()
    expect(executeAiIntentPlan).not.toHaveBeenCalled()
  })

  it("high-confidence reminder task skips full planner", async () => {
    const { streamAiChat } = await import("@/server/services/ai-chat-service")
    await streamAiChat({
      userId: "owner",
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      messages: [{ role: "user", content: "我明天中午十二点要吃药" }],
    })
    expect(buildFullPlannerContext).not.toHaveBeenCalled()
    expect(planAiIntent).not.toHaveBeenCalled()
    expect(executeAiIntentPlan).toHaveBeenCalledWith(expect.objectContaining({
      stateOptions: expect.objectContaining({ scope: "tasks" }),
    }))
  })

  it("destructive schedule skips full planner", async () => {
    const { streamAiChat } = await import("@/server/services/ai-chat-service")
    await streamAiChat({
      userId: "owner",
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      messages: [{ role: "user", content: "清除所有规划" }],
    })
    expect(buildFullPlannerContext).not.toHaveBeenCalled()
    expect(planAiIntent).not.toHaveBeenCalled()
    expect(executeAiIntentPlan).toHaveBeenCalledWith(expect.objectContaining({
      stateOptions: expect.objectContaining({ scope: "destructive" }),
    }))
  })

  it("low-confidence fast path degrades to full planner", async () => {
    buildDeterministicPlan.mockReturnValue(null)
    buildFullPlannerContext.mockResolvedValue({
      nowIso: new Date().toISOString(),
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      tasks: [],
      notes: [],
      tags: [],
      searchResults: [],
    })
    planAiIntent.mockResolvedValue({
      mode: "execute",
      intentSummary: "full",
      confidence: 1,
      assumptions: [],
      actions: [],
      userFacingSummary: "ok",
    })

    const { streamAiChat } = await import("@/server/services/ai-chat-service")
    await streamAiChat({
      userId: "owner",
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      messages: [{ role: "user", content: "接下来一周我每天晚上9点要做30分钟那个考试练习" }],
    })
    expect(buildFullPlannerContext).toHaveBeenCalled()
    expect(planAiIntent).toHaveBeenCalled()
  })
})
