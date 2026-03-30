import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TZDate } from "@date-fns/tz"
import { executeAiIntentPlan } from "@/server/ai/executor"
import { planAiIntent } from "@/server/ai/planner"
import { createInMemoryRepository } from "@/server/ai/__tests__/helpers"
import type { AiPlannerContext } from "@/server/ai/contracts"

function makeContext(locale: "zh-Hans" | "en", timeZone: string): AiPlannerContext {
  return {
    nowIso: new Date().toISOString(),
    locale,
    timeZone,
    tasks: [],
    notes: [],
    tags: [],
    searchResults: [],
  }
}

async function planAndExecute(input: {
  text: string
  locale?: "zh-Hans" | "en"
  timeZone?: string
  seed?: Parameters<typeof createInMemoryRepository>[0]
}) {
  const locale = input.locale ?? "zh-Hans"
  const timeZone = input.timeZone ?? "Asia/Shanghai"
  const runtime = createInMemoryRepository(input.seed)
  const plan = await planAiIntent({
    locale,
    timeZone,
    context: makeContext(locale, timeZone),
    messages: [{ role: "user", content: input.text }],
  })
  const result = await executeAiIntentPlan({
    userId: "owner",
    locale,
    repository: runtime.repository,
    plan,
  })
  return { runtime, plan, result }
}

describe("AI regression intents", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-30T08:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("1. 明天中午吃药 -> task + reminderAt only", async () => {
    const { runtime } = await planAndExecute({ text: "我明天中午要吃药，大概十二点" })
    expect(runtime.db.inbox).toHaveLength(0)
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].dueAt).toBeNull()
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(0)
    const local = new TZDate(runtime.db.tasks[0].reminderAt!, "Asia/Shanghai")
    expect(local.getHours()).toBe(12)
  })

  it("2. 周五前交报告 -> dueAt only", async () => {
    const { runtime } = await planAndExecute({ text: "周五前交报告" })
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(0)
    const local = new TZDate(runtime.db.tasks[0].dueAt!, "Asia/Shanghai")
    expect(local.getHours()).toBe(23)
    expect(local.getMinutes()).toBe(59)
  })

  it("3. 明天下午三点写报告半小时 -> task + timeBlock", async () => {
    const { runtime } = await planAndExecute({ text: "明天下午三点写报告半小时" })
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(1)
    expect(runtime.db.tasks[0].dueAt).toBeNull()
  })

  it("4. 接下来一周每天早上八点跑步 -> recurring schedule", async () => {
    const { runtime } = await planAndExecute({ text: "接下来一周每天早上八点跑步" })
    expect(runtime.db.inbox).toHaveLength(0)
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks.length).toBeGreaterThanOrEqual(7)
  })

  it("4b. 接下来一周我每天晚上9点要做30分钟托福 -> recurring schedule with clean title", async () => {
    const { runtime, result } = await planAndExecute({ text: "接下来一周我每天晚上9点要做30分钟托福" })
    expect(runtime.db.inbox).toHaveLength(0)
    expect(runtime.db.notes).toHaveLength(0)
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].title).toBe("托福")
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(7)
    const first = new TZDate(runtime.db.tasks[0].timeBlocks[0].startAt, "Asia/Shanghai")
    const firstEnd = new TZDate(runtime.db.tasks[0].timeBlocks[0].endAt, "Asia/Shanghai")
    expect(first.getHours()).toBe(21)
    expect(firstEnd.getMinutes() - first.getMinutes() + (firstEnd.getHours() - first.getHours()) * 60).toBe(30)
    expect(result.userFacingSummary).toContain("托福")
    expect(result.userFacingSummary).not.toContain("我每天晚上9点要做")
  })

  it("5. 接下来一周每天中午吃药 -> expanded reminder tasks", async () => {
    const { runtime } = await planAndExecute({ text: "接下来一周每天中午吃药" })
    expect(runtime.db.tasks.length).toBeGreaterThanOrEqual(7)
    expect(runtime.db.tasks.every((task) => task.timeBlocks.length === 0)).toBe(true)
    expect(runtime.db.tasks.every((task) => task.reminderAt)).toBe(true)
  })

  it("6. LLM 世界想法 -> enriched note only", async () => {
    const { runtime } = await planAndExecute({ text: "我今天想到是否能构建一个 LLM 的世界，有奖励机制，让 LLM 在里面自由发展" })
    expect(runtime.db.notes).toHaveLength(1)
    expect(runtime.db.tasks).toHaveLength(0)
    expect(runtime.db.notes[0].contentMd).toContain("## 原始想法")
  })

  it("7. 想法 + 明天查一下 -> note + task + link", async () => {
    const { runtime } = await planAndExecute({ text: "我今天想到一个 LLM 世界模型，明天查一下多智能体奖励机制" })
    expect(runtime.db.notes).toHaveLength(1)
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.notes[0].noteTasks).toHaveLength(1)
  })

  it("8. 安排写论文 + 周五前交初稿 -> recurring schedule + dueAt", async () => {
    const { runtime } = await planAndExecute({ text: "把接下来一周都安排写论文，每天下午 2 点 1 小时，周五前交初稿" })
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks.length).toBeGreaterThanOrEqual(7)
    expect(runtime.db.tasks[0].dueAt).toBeTruthy()
  })

  it("9. 补充奖励机制想法并关联 agent economy -> update + note link", async () => {
    const { runtime } = await planAndExecute({
      text: "把我上次关于奖励机制那条想法补充一下，顺便和 agent economy 那条关联",
      seed: {
        notes: [
          { id: "note_reward", title: "奖励机制", summary: "old", contentMd: "old" },
          { id: "note_agent", title: "agent economy", summary: "old2", contentMd: "old2" },
        ],
      },
    })
    expect(runtime.db.notes.find((note) => note.id === "note_reward")?.contentMd).toContain("## 补充")
    expect(runtime.db.noteLinks).toHaveLength(1)
  })

  it("10. 先记一下...晚点再整理 -> inbox", async () => {
    const { runtime } = await planAndExecute({ text: "先记一下：也许可以把 agent 的奖励拆成短期反馈和长期声誉，晚点再整理" })
    expect(runtime.db.inbox).toHaveLength(1)
  })

  it("deduplicates same-title same-reminder task occurrences", async () => {
    const first = await planAndExecute({ text: "我明天中午要吃药，大概十二点" })
    const second = await planAndExecute({
      text: "我明天中午要吃药，大概十二点",
      seed: { tasks: first.runtime.db.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString() ?? null,
        reminderAt: task.reminderAt?.toISOString() ?? null,
        updatedAt: task.updatedAt.toISOString(),
      })) },
    })
    expect(second.runtime.db.tasks).toHaveLength(1)
  })

  it("handles mixed Chinese + English schedule phrasing", async () => {
    const { runtime } = await planAndExecute({
      text: "明天下午 3pm 写 report 30 分钟",
      timeZone: "America/Los_Angeles",
    })
    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(1)
  })
})
