import { describe, expect, it } from "vitest"
import { buildAiSummary } from "@/server/ai/summary"
import type { AiIntentPlan } from "@/server/ai/contracts"

const plan: AiIntentPlan = {
  mode: "execute",
  intentSummary: "test",
  confidence: 1,
  assumptions: [],
  actions: [],
  userFacingSummary: "",
}

describe("summary", () => {
  it("formats recurring schedule summary with correct title", () => {
    const text = buildAiSummary({
      plan,
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      mutations: Array.from({ length: 7 }).map((_, index) => ({
        type: "time_block_created" as const,
        taskId: "task_toefl",
        taskTitle: "托福",
        blockId: `block_${index}`,
        startAt: new Date(Date.UTC(2026, 2, 30 + index, 13, 0, 0)).toISOString(),
        endAt: new Date(Date.UTC(2026, 2, 30 + index, 13, 30, 0)).toISOString(),
      })),
    })
    expect(text).toContain("托福")
    expect(text).not.toContain("我每天晚上9点要做")
  })

  it("formats reminder task summaries without 记下", () => {
    const text = buildAiSummary({
      plan,
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      mutations: [
        {
          type: "task_created",
          taskId: "task_meds",
          title: "吃药",
          reminderAt: "2026-03-31T04:00:00.000Z",
          dueAt: null,
        },
      ],
    })
    expect(text).toContain("已创建任务")
    expect(text).toContain("提醒时间")
    expect(text).not.toContain("记下")
  })
})
