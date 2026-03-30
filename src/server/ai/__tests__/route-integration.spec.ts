import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const streamAiChat = vi.fn().mockResolvedValue({
  stream: new ReadableStream(),
  diagnostics: {
    routeKind: "FAST_REMINDER_TASK",
    timings: { total: 1 },
    usedDb: true,
    usedExecutor: true,
    usedFullPlanner: false,
  },
})

vi.mock("@/server/services/ai-chat-service", () => ({
  streamAiChat,
  toServerTimingHeader: () => "total;dur=1",
}))

vi.mock("@/lib/auth", () => ({
  isAuthenticated: async () => true,
  getCurrentUserId: async () => "owner",
}))

vi.mock("@/server/mobile/auth", () => ({
  requireMobileSession: async () => ({ user: { id: "owner" } }),
  buildAuthenticatedMobileContext: async () => ({ settings: { language: "zh-Hans", timezone: "Asia/Shanghai" } }),
}))

describe("route integration", () => {
  it("web route uses canonical AI core", async () => {
    const { POST } = await import("@/app/api/ai/route")
    const request = new NextRequest("http://localhost/api/ai", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "我明天中午十二点要吃药" }] }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(request)
    expect(streamAiChat).toHaveBeenCalled()
  })

  it("mobile route uses canonical AI core", async () => {
    const { POST } = await import("@/app/api/mobile/v1/ai/chat/route")
    const request = new Request("http://localhost/api/mobile/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "我明天中午十二点要吃药" }] }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(request)
    expect(streamAiChat).toHaveBeenCalledTimes(2)
  })
})
