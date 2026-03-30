import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import {
  aiIntentPlanSchema,
  AiIntentPlan,
  AiPlannerContext,
  RECURRING_EXPANSION_LIMIT,
} from "@/server/ai/contracts"
import { buildPlannerPrompt } from "@/server/ai/prompt"
import {
  buildOccurrencesFromDailyReminder,
  buildOccurrencesFromRecurringSchedule,
  COARSE_TIME_MAP,
  isDeadlineIntent,
  isExplicitInboxIntent,
  isReminderIntent,
  isScheduleIntent,
  parseRecurringWindow,
  parseTimePoint,
  parseDurationMinutes,
} from "@/server/ai/time-semantics"
import { deriveNoteTitle, deriveSearchQueries, deriveTaskTitle, normalizeWhitespace, splitClauses, stripLeadingPhrases } from "@/server/ai/normalization"

type PlannerMessage = {
  role: "user" | "assistant"
  content: string
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })
  : null

function buildNoteContent(raw: string) {
  const cleaned = stripLeadingPhrases(raw)
  return [
    "## 原始想法",
    cleaned,
    "",
    "## 核心命题",
    `- ${cleaned}`,
    "",
    "## 可能机制 / 解释框架",
    "- 假设：这一想法可能依赖某种尚未验证的机制。",
    "- 假设：需要进一步拆解核心变量、边界条件和反馈回路。",
    "",
    "## 值得验证的问题",
    "- 待验证：这个想法最关键的成立条件是什么？",
    "- 待验证：有哪些反例、边界情况或失败模式？",
    "",
    "## 可能的实验 / 下一步",
    "- 把问题拆成 2 到 3 个可检验的小问题。",
    "- 补充相关资料、案例或已有方案进行对照。",
    "",
    "## 风险 / 反例 / 不确定点",
    "- 不确定：当前内容主要基于用户原始想法，还没有外部证据支撑。",
  ].join("\n")
}

function buildNoteSummary(raw: string) {
  const cleaned = normalizeWhitespace(stripLeadingPhrases(raw))
  return cleaned.length > 100 ? `${cleaned.slice(0, 100).trim()}…` : cleaned
}

function isIdeaLike(text: string) {
  return /(想到|想法|我在想|我觉得|洞见|反思|是否能|也许可以|灵感|idea|thought|hypothesis|world model)/iu.test(text)
}

function isActionLike(text: string) {
  return /(提醒|记得|要|得|需要|安排|写|做|查一下|交|提交|schedule|remind|need to|must|should|take medicine|run|write|check)/iu.test(text)
}

function buildRecurringTaskTitle(base: string, index: number, occurrences: number) {
  if (occurrences <= 1) return base
  return `${base} #${index + 1}`
}

function buildHeuristicPlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}): AiIntentPlan | null {
  const text = normalizeWhitespace(input.text)
  const now = input.now ?? new Date()
  const clauses = splitClauses(text)

  if (!text) return null

  if (isExplicitInboxIntent(text)) {
    return {
      mode: "execute",
      confidence: 0.98,
      intentSummary: "Explicit quick capture to inbox",
      assumptions: ["User explicitly asked to capture now and organize later."],
      actions: [{ type: "capture_to_inbox", content: text }],
      userFacingSummary: input.locale === "en" ? "Captured to inbox for later review." : "已放入收件箱，稍后再整理。",
    }
  }

  if (/补充一下.*关联|补充.*关联/u.test(text)) {
    const match = text.match(/关于(.+?)那条.*?(?:和|与)\s*(.+?)那条/u)
    const fromQuery = match?.[1]?.trim() ?? clauses[0] ?? text
    const toQuery = match?.[2]?.trim() ?? clauses[1] ?? text
    return {
      mode: "execute",
      confidence: 0.93,
      intentSummary: "Update an existing note and add a note-to-note relation",
      assumptions: ["The referenced notes already exist and can be found by query."],
      actions: [
        {
          type: "upsert_note",
          title: deriveNoteTitle(fromQuery),
          summary: buildNoteSummary(text),
          contentMd: buildNoteContent(text),
          typeHint: "OTHER",
          importance: "MEDIUM",
          updateStrategy: "enrich_existing",
          targetQuery: fromQuery,
          sourceText: text,
        },
        {
          type: "link_note_to_note",
          fromQuery,
          toQuery,
          relationType: "RELATED",
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll enrich the existing note and link it to the related note." : "我会补充已有想法，并把它和相关笔记关联起来。",
    }
  }

  const recurringWindow = parseRecurringWindow(text)
  if (recurringWindow && /每天|every day/iu.test(text)) {
    const taskTitle = deriveTaskTitle(text)
    if (isReminderIntent(text) || /吃药|缴费|打电话|医院/u.test(text)) {
      const occurrences = buildOccurrencesFromDailyReminder(text, input.timeZone, now, COARSE_TIME_MAP.noon.hour, COARSE_TIME_MAP.noon.minute)
      return {
        mode: "execute",
        confidence: 0.98,
        intentSummary: "Recurring discrete reminder task",
        assumptions: [`Expanded to at most ${RECURRING_EXPANSION_LIMIT} occurrences.`],
        actions: [
          {
            type: "bulk_create_discrete_tasks",
            title: taskTitle,
            description: text,
            occurrences: occurrences.map((occurrence, index) => ({
              title: buildRecurringTaskTitle(taskTitle, index, occurrences.length),
              reminderAt: occurrence.reminderAt ?? null,
              dueAt: null,
            })),
          },
        ],
        userFacingSummary: input.locale === "en" ? "I’ll create repeated reminder tasks for the coming week." : "我会把接下来一周的离散提醒任务展开创建出来。",
      }
    }

    const occurrences = buildOccurrencesFromRecurringSchedule(text, input.timeZone, now, parseDurationMinutes(text, 30))
    const actions: AiIntentPlan["actions"] = []
    if (isDeadlineIntent(text)) {
      actions.push({
        type: "upsert_task",
        title: taskTitle,
        description: text,
        status: "TODO",
        priority: "MEDIUM",
        dueAt: parseTimePoint(text, input.timeZone, now, { dateOnlyAsEndOfDay: true }).at.toISOString(),
        matchStrategy: "normalized_title",
        targetQuery: taskTitle,
        sourceText: text,
      })
    }
    actions.push({
      type: "create_recurring_schedule",
      taskTitle,
      taskQuery: taskTitle,
      createTaskIfMissing: true,
      taskDescriptionIfCreate: text,
      occurrences,
    })
    return {
      mode: "execute",
      confidence: 0.96,
      intentSummary: "Recurring scheduled work sessions",
      assumptions: [`Expanded to at most ${RECURRING_EXPANSION_LIMIT} schedule occurrences.`],
      actions,
      userFacingSummary: input.locale === "en" ? "I’ll set up repeated scheduled sessions for the next week." : "我会为接下来一周建立重复的计划时段。",
    }
  }

  const noteClause = clauses.find((clause) => isIdeaLike(clause))
  const actionClause = clauses.find((clause) => clause !== noteClause && isActionLike(clause))
  if (noteClause && actionClause) {
    const taskTitle = deriveTaskTitle(actionClause)
    const reminder = isReminderIntent(actionClause)
      ? parseTimePoint(actionClause, input.timeZone, now, { defaultHour: 9, defaultMinute: 0 })
      : null
    return {
      mode: "execute",
      confidence: 0.95,
      intentSummary: "Compound note plus follow-up task",
      assumptions: [],
      actions: [
        {
          type: "upsert_task",
          title: taskTitle,
          description: actionClause,
          status: "TODO",
          priority: "MEDIUM",
          reminderAt: reminder?.at.toISOString() ?? null,
          matchStrategy: "normalized_title",
          targetQuery: taskTitle,
          sourceText: actionClause,
        },
        {
          type: "upsert_note",
          title: deriveNoteTitle(noteClause),
          summary: buildNoteSummary(noteClause),
          contentMd: buildNoteContent(noteClause),
          typeHint: "OTHER",
          importance: "MEDIUM",
          relatedTaskTitles: [taskTitle],
          updateStrategy: "create_new",
          sourceText: noteClause,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll save the idea as a note and create the follow-up task." : "我会把想法记成笔记，并同时创建后续任务。",
    }
  }

  if (isIdeaLike(text) && !isActionLike(text.replace(noteClause ?? "", ""))) {
    return {
      mode: "execute",
      confidence: 0.9,
      intentSummary: "Idea-like input should become a structured note",
      assumptions: [],
      actions: [
        {
          type: "upsert_note",
          title: deriveNoteTitle(text),
          summary: buildNoteSummary(text),
          contentMd: buildNoteContent(text),
          typeHint: "OTHER",
          importance: "MEDIUM",
          updateStrategy: "create_new",
          sourceText: text,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll turn that into a structured note." : "我会把这条想法整理成结构化笔记。",
    }
  }

  if (isScheduleIntent(text) && !recurringWindow) {
    const taskTitle = deriveTaskTitle(text)
    const start = parseTimePoint(text, input.timeZone, now, {
      defaultHour: COARSE_TIME_MAP.afternoon.hour,
      defaultMinute: COARSE_TIME_MAP.afternoon.minute,
    })
    const duration = parseDurationMinutes(text, 30)
    const endAt = new Date(start.at.getTime() + duration * 60000)

    const actions: AiIntentPlan["actions"] = []
    if (isDeadlineIntent(text)) {
      actions.push({
        type: "upsert_task",
        title: taskTitle,
        description: text,
        status: "TODO",
        priority: "MEDIUM",
        dueAt: parseTimePoint(text, input.timeZone, now, { dateOnlyAsEndOfDay: true }).at.toISOString(),
        matchStrategy: "normalized_title",
        targetQuery: taskTitle,
        sourceText: text,
      })
    }
    actions.push({
      type: "schedule_task",
      taskTitle,
      taskQuery: taskTitle,
      createTaskIfMissing: true,
      taskDescriptionIfCreate: text,
      startAt: start.at.toISOString(),
      endAt: endAt.toISOString(),
      isAllDay: false,
    })
    return {
      mode: "execute",
      confidence: 0.96,
      intentSummary: "One-off scheduled work session",
      assumptions: duration === 30 ? ["No explicit duration found; defaulted to 30 minutes."] : [],
      actions,
      userFacingSummary: input.locale === "en" ? "I’ll schedule that task for the specified time." : "我会把这件事安排到对应时段。",
    }
  }

  if (isDeadlineIntent(text)) {
    const taskTitle = deriveTaskTitle(text)
    const dueAt = parseTimePoint(text, input.timeZone, now, { dateOnlyAsEndOfDay: true })
    return {
      mode: "execute",
      confidence: 0.95,
      intentSummary: "Deadline task",
      assumptions: ["Date-only deadline mapped to 23:59:59 local time."],
      actions: [
        {
          type: "upsert_task",
          title: taskTitle,
          description: text,
          status: "TODO",
          priority: "MEDIUM",
          dueAt: dueAt.at.toISOString(),
          matchStrategy: "normalized_title",
          targetQuery: taskTitle,
          sourceText: text,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll create or update the task with a deadline." : "我会创建或更新这个任务，并设置截止时间。",
    }
  }

  if (isReminderIntent(text)) {
    const taskTitle = deriveTaskTitle(text)
    const reminderAt = parseTimePoint(text, input.timeZone, now, {
      defaultHour: COARSE_TIME_MAP.morning.hour,
      defaultMinute: COARSE_TIME_MAP.morning.minute,
    })
    return {
      mode: "execute",
      confidence: 0.96,
      intentSummary: "Discrete reminder task",
      assumptions: [],
      actions: [
        {
          type: "upsert_task",
          title: taskTitle,
          description: text,
          status: "TODO",
          priority: "MEDIUM",
          reminderAt: reminderAt.at.toISOString(),
          matchStrategy: "normalized_title",
          targetQuery: taskTitle,
          sourceText: text,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll create or update a reminder task." : "我会创建或更新一个带提醒时间的任务。",
    }
  }

  return null
}

export async function planAiIntent(input: {
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: PlannerMessage[]
  context: AiPlannerContext
}): Promise<AiIntentPlan> {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? ""
  const heuristic = buildHeuristicPlan({
    text: latestUserMessage,
    locale: input.locale,
    timeZone: input.timeZone,
  })
  if (heuristic) {
    return aiIntentPlanSchema.parse(heuristic)
  }

  if (!openai) {
    return {
      mode: "clarify",
      confidence: 0.2,
      intentSummary: "No OpenAI API key available for planner fallback",
      assumptions: [],
      actions: [],
      userFacingSummary: input.locale === "en" ? "I need a bit more detail before I can safely act on that." : "我还需要你补充一点信息，才能安全地帮你执行。",
    }
  }

  const completion = await openai.chat.completions.parse({
    model: "gpt-5.4-mini",
    response_format: zodResponseFormat(aiIntentPlanSchema, "ai_intent_plan"),
    messages: [
      { role: "system", content: buildPlannerPrompt(input.context) },
      {
        role: "user",
        content: JSON.stringify({
          messages: input.messages,
          latestUserMessage,
        }),
      },
    ],
  })

  const parsed = completion.choices[0]?.message?.parsed
  if (!parsed) {
    throw new Error("Planner returned no structured plan")
  }

  return aiIntentPlanSchema.parse(parsed)
}
