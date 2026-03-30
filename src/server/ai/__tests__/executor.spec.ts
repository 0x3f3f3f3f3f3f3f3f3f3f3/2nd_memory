import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { executeAiIntentPlan } from "@/server/ai/executor"
import { createInMemoryRepository } from "@/server/ai/__tests__/helpers"

describe("executor", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-30T08:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reuses an existing task when scheduling a work session", async () => {
    const runtime = createInMemoryRepository({
      tasks: [{ id: "task_report", title: "写报告", status: "TODO" }],
    })

    await executeAiIntentPlan({
      userId: "owner",
      locale: "zh-Hans",
      repository: runtime.repository,
      plan: {
        mode: "execute",
        confidence: 1,
        intentSummary: "schedule existing task",
        assumptions: [],
        userFacingSummary: "",
        actions: [
          {
            type: "schedule_task",
            taskTitle: "写报告",
            taskQuery: "写报告",
            createTaskIfMissing: true,
            startAt: "2026-03-31T07:00:00.000Z",
            endAt: "2026-03-31T07:30:00.000Z",
            isAllDay: false,
          },
        ],
      },
    })

    expect(runtime.db.tasks).toHaveLength(1)
    expect(runtime.db.tasks[0].timeBlocks).toHaveLength(1)
  })

  it("is idempotent for repeated discrete reminder occurrences", async () => {
    const runtime = createInMemoryRepository({
      tasks: [
        {
          title: "吃药 #1",
          reminderAt: "2026-03-31T04:00:00.000Z",
        },
      ],
    })

    await executeAiIntentPlan({
      userId: "owner",
      locale: "zh-Hans",
      repository: runtime.repository,
      plan: {
        mode: "execute",
        confidence: 1,
        intentSummary: "bulk reminder tasks",
        assumptions: [],
        userFacingSummary: "",
        actions: [
          {
            type: "bulk_create_discrete_tasks",
            title: "吃药",
            description: "接下来一周每天中午吃药",
            occurrences: [
              { title: "吃药 #1", reminderAt: "2026-03-31T04:00:00.000Z", dueAt: null },
              { title: "吃药 #2", reminderAt: "2026-04-01T04:00:00.000Z", dueAt: null },
            ],
          },
        ],
      },
    })

    expect(runtime.db.tasks).toHaveLength(2)
  })

  it("updates an existing note and creates a note link", async () => {
    const runtime = createInMemoryRepository({
      notes: [
        { id: "note_reward", title: "奖励机制想法", contentMd: "old", summary: "old" },
        { id: "note_agent", title: "agent economy", contentMd: "old2", summary: "old2" },
      ],
    })

    await executeAiIntentPlan({
      userId: "owner",
      locale: "zh-Hans",
      repository: runtime.repository,
      plan: {
        mode: "execute",
        confidence: 1,
        intentSummary: "update and link notes",
        assumptions: [],
        userFacingSummary: "",
        actions: [
          {
            type: "upsert_note",
            title: "奖励机制想法",
            summary: "补充 summary",
            contentMd: "新的补充内容",
            typeHint: "OTHER",
            importance: "MEDIUM",
            updateStrategy: "enrich_existing",
            targetQuery: "奖励机制",
          },
          {
            type: "link_note_to_note",
            fromQuery: "奖励机制",
            toQuery: "agent economy",
            relationType: "RELATED",
          },
        ],
      },
    })

    expect(runtime.db.notes[0].contentMd).toContain("新的补充内容")
    expect(runtime.db.noteLinks).toHaveLength(1)
  })
})
