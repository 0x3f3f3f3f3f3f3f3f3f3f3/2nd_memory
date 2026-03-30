import { describe, expect, it } from "vitest"
import { classifyAiRoute } from "@/server/ai/router"

describe("classifier", () => {
  it("routes NON_DB_CHAT", () => {
    expect(classifyAiRoute("解释一下什么是世界模型").kind).toBe("NON_DB_CHAT")
  })

  it("routes FAST_REMINDER_TASK", () => {
    expect(classifyAiRoute("我明天中午十二点要吃药").kind).toBe("FAST_REMINDER_TASK")
  })

  it("routes FAST_DEADLINE_TASK", () => {
    expect(classifyAiRoute("周五前交报告").kind).toBe("FAST_DEADLINE_TASK")
  })

  it("routes FAST_SCHEDULE_TASK", () => {
    expect(classifyAiRoute("明天下午三点写报告半小时").kind).toBe("FAST_SCHEDULE_TASK")
  })

  it("routes FAST_RECURRING_REMINDER", () => {
    expect(classifyAiRoute("接下来一周每天中午吃药").kind).toBe("FAST_RECURRING_REMINDER")
  })

  it("routes FAST_RECURRING_SCHEDULE", () => {
    expect(classifyAiRoute("接下来一周我每天晚上9点要做30分钟托福").kind).toBe("FAST_RECURRING_SCHEDULE")
  })

  it("routes DESTRUCTIVE_SCHEDULE", () => {
    expect(classifyAiRoute("清除所有规划").kind).toBe("DESTRUCTIVE_SCHEDULE")
  })

  it("routes FULL_PLANNER", () => {
    expect(classifyAiRoute("我今天想到一个 LLM 世界模型，明天查一下多智能体奖励机制").kind).toBe("FULL_PLANNER")
  })
})
