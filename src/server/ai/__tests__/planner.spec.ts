import { describe, expect, beforeEach, afterEach, it, vi } from "vitest"
import { planAiIntent } from "@/server/ai/planner"
import type { AiPlannerContext } from "@/server/ai/contracts"
import { TZDate } from "@date-fns/tz"

const baseContext: AiPlannerContext = {
  nowIso: "2026-03-30T08:00:00.000Z",
  locale: "zh-Hans",
  timeZone: "Asia/Shanghai",
  tasks: [],
  notes: [],
  tags: [],
  searchResults: [],
}

describe("planner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-30T08:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("plans reminder tasks without turning them into due dates", async () => {
    const plan = await planAiIntent({
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      context: baseContext,
      messages: [{ role: "user", content: "我明天中午要吃药，大概十二点" }],
    })

    expect(plan.mode).toBe("execute")
    expect(plan.actions[0]?.type).toBe("upsert_task")
    const action = plan.actions[0]
    if (action?.type !== "upsert_task") throw new Error("unexpected action")
    expect(action.reminderAt).toBeTruthy()
    expect(action.dueAt ?? null).toBeNull()
    const local = new TZDate(new Date(action.reminderAt!), "Asia/Shanghai")
    expect(local.getHours()).toBe(12)
    expect(local.getDate()).toBe(31)
  })

  it("plans scheduled work sessions as schedule_task", async () => {
    const plan = await planAiIntent({
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      context: baseContext,
      messages: [{ role: "user", content: "明天下午三点写报告半小时" }],
    })

    expect(plan.actions.some((action) => action.type === "schedule_task")).toBe(true)
    const schedule = plan.actions.find((action) => action.type === "schedule_task")
    if (!schedule || schedule.type !== "schedule_task") throw new Error("missing schedule")
    const start = new TZDate(new Date(schedule.startAt), "Asia/Shanghai")
    const end = new TZDate(new Date(schedule.endAt), "Asia/Shanghai")
    expect(start.getHours()).toBe(15)
    expect(end.getMinutes() - start.getMinutes() + (end.getHours() - start.getHours()) * 60).toBe(30)
  })

  it("plans pure idea input as enriched note, not inbox", async () => {
    const plan = await planAiIntent({
      locale: "zh-Hans",
      timeZone: "Asia/Shanghai",
      context: baseContext,
      messages: [{ role: "user", content: "我今天想到是否能构建一个 LLM 的世界，有奖励机制，让 LLM 在里面自由发展" }],
    })

    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]?.type).toBe("upsert_note")
    const note = plan.actions[0]
    if (note?.type !== "upsert_note") throw new Error("missing note action")
    expect(note.contentMd).toContain("## 原始想法")
    expect(note.contentMd).toContain("## 可能的实验 / 下一步")
  })

  it("supports english reminder inputs", async () => {
    const plan = await planAiIntent({
      locale: "en",
      timeZone: "America/Los_Angeles",
      context: { ...baseContext, locale: "en", timeZone: "America/Los_Angeles" },
      messages: [{ role: "user", content: "Take medicine tomorrow at noon" }],
    })

    const action = plan.actions[0]
    expect(action?.type).toBe("upsert_task")
    if (action?.type !== "upsert_task") throw new Error("unexpected action")
    expect(action.reminderAt).toBeTruthy()
    const local = new TZDate(new Date(action.reminderAt!), "America/Los_Angeles")
    expect(local.getHours()).toBe(12)
  })
})
