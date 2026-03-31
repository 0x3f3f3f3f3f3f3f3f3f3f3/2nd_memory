import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import {
  AiRouteKind,
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
  hasCoarseExecutionSlot,
  hasExplicitExecutionTime,
  isCancelOccurrenceIntent,
  isDeadlineIntent,
  isDiscreteActionVerb,
  isExplicitInboxIntent,
  isReminderIntent,
  isRescheduleIntent,
  isScheduleIntent,
  isWorkSessionVerb,
  parseRecurringWindow,
  parseTimePoint,
  parseDurationMinutes,
} from "@/server/ai/time-semantics"
import { deriveNoteTitle, deriveSearchQueries, deriveTaskTitle, normalizeWhitespace, splitClauses, stripLeadingPhrases } from "@/server/ai/normalization"
import { extractTitle } from "@/server/ai/title-extractor"

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

function buildReminderPlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}): AiIntentPlan | null {
  const title = extractTitle(input.text, "task")
  if (title.confidence < 0.95) return null
  const hasExecutionSlot = hasExplicitExecutionTime(input.text) || hasCoarseExecutionSlot(input.text)
  const isDiscreteExecution = isDiscreteActionVerb(input.text)
  const reminderAt = parseTimePoint(input.text, input.timeZone, input.now ?? new Date(), {
    defaultHour: COARSE_TIME_MAP.morning.hour,
    defaultMinute: COARSE_TIME_MAP.morning.minute,
  })
  if (hasExecutionSlot && isDiscreteExecution) {
    const duration = /(医院|复诊|dentist|doctor|meeting|开会)/iu.test(input.text) ? 60 : 15
    const endAt = new Date(reminderAt.at.getTime() + duration * 60000)
    return {
      mode: "execute",
      confidence: 0.98,
      intentSummary: "Timed discrete execution occurrence",
      assumptions: [],
      actions: [
        {
          type: "ensure_task_occurrence",
          taskTitle: title.title,
          taskQuery: title.title,
          createTaskIfMissing: true,
          taskDescriptionIfCreate: normalizeWhitespace(input.text),
          reminderAt: reminderAt.at.toISOString(),
          startAt: reminderAt.at.toISOString(),
          endAt: endAt.toISOString(),
          isAllDay: false,
          occurrenceKind: "discrete_execution",
          priority: "MEDIUM",
          status: "TODO",
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll create or update the task and place it into the plan." : "我会创建或更新任务，并把它加入规划。",
    }
  }
  return {
    mode: "execute",
    confidence: 0.98,
    intentSummary: "Discrete reminder task",
    assumptions: [],
    actions: [
      {
        type: "upsert_task",
        title: title.title,
        description: normalizeWhitespace(input.text),
        status: "TODO",
        priority: "MEDIUM",
        reminderAt: reminderAt.at.toISOString(),
        matchStrategy: "normalized_title",
        targetQuery: title.title,
        sourceText: input.text,
      },
    ],
    userFacingSummary: input.locale === "en" ? "I’ll create or update the reminder task." : "我会创建或更新提醒任务。",
  }
}

function buildDeadlinePlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}) {
  const title = extractTitle(input.text, "task")
  if (title.confidence < 0.95) return null
  const dueAt = parseTimePoint(input.text, input.timeZone, input.now ?? new Date(), { dateOnlyAsEndOfDay: true })
  return {
    mode: "execute",
    confidence: 0.97,
    intentSummary: "Deadline task",
    assumptions: ["Date-only deadline mapped to 23:59:59 local time."],
    actions: [
      {
        type: "upsert_task",
        title: title.title,
        description: normalizeWhitespace(input.text),
        status: "TODO",
        priority: "MEDIUM",
        dueAt: dueAt.at.toISOString(),
        matchStrategy: "normalized_title",
        targetQuery: title.title,
        sourceText: input.text,
      },
    ],
    userFacingSummary: input.locale === "en" ? "I’ll create or update the task with a deadline." : "我会创建或更新这个任务，并设置截止时间。",
  } satisfies AiIntentPlan
}

function buildSchedulePlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}) {
  const title = extractTitle(input.text, "schedule_subject")
  if (title.confidence < 0.95) return null
  const start = parseTimePoint(input.text, input.timeZone, input.now ?? new Date(), {
    defaultHour: COARSE_TIME_MAP.afternoon.hour,
    defaultMinute: COARSE_TIME_MAP.afternoon.minute,
  })
  const duration = parseDurationMinutes(input.text, 30)
  const endAt = new Date(start.at.getTime() + duration * 60000)
  return {
    mode: "execute",
    confidence: 0.97,
    intentSummary: "Scheduled work session",
    assumptions: duration === 30 ? ["No explicit duration found; defaulted to 30 minutes."] : [],
    actions: [
      {
        type: "schedule_task",
        taskTitle: title.title,
        taskQuery: title.title,
        createTaskIfMissing: true,
        taskDescriptionIfCreate: normalizeWhitespace(input.text),
        startAt: start.at.toISOString(),
        endAt: endAt.toISOString(),
        isAllDay: false,
      },
    ],
    userFacingSummary: input.locale === "en" ? "I’ll schedule that task." : "我会把这件事安排到对应时段。",
  } satisfies AiIntentPlan
}

function buildRecurringReminderPlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}) {
  const title = extractTitle(input.text, "task")
  if (title.confidence < 0.95) return null
  const occurrences = buildOccurrencesFromDailyReminder(input.text, input.timeZone, input.now ?? new Date(), COARSE_TIME_MAP.noon.hour, COARSE_TIME_MAP.noon.minute)
  if (hasExplicitExecutionTime(input.text) || hasCoarseExecutionSlot(input.text)) {
    return {
      mode: "execute",
      confidence: 0.98,
      intentSummary: "Recurring discrete timed occurrences",
      assumptions: [`Expanded to at most ${RECURRING_EXPANSION_LIMIT} occurrences.`],
      actions: [
        {
          type: "bulk_ensure_task_occurrences",
          taskTitle: title.title,
          taskQuery: title.title,
          createTaskIfMissing: true,
          taskDescriptionIfCreate: normalizeWhitespace(input.text),
          occurrenceKind: "discrete_execution",
          priority: "MEDIUM",
          status: "TODO",
          occurrences: occurrences.map((occurrence) => ({
            title: title.title,
            reminderAt: occurrence.reminderAt ?? null,
            startAt: occurrence.reminderAt!,
            endAt: new Date(new Date(occurrence.reminderAt!).getTime() + 15 * 60000).toISOString(),
            dueAt: null,
            isAllDay: false,
          })),
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll create recurring occurrences and put them into the plan." : "我会创建重复 occurrence，并让它们进入规划。",
    } satisfies AiIntentPlan
  }
  return {
    mode: "execute",
    confidence: 0.98,
    intentSummary: "Recurring discrete reminder task",
    assumptions: [`Expanded to at most ${RECURRING_EXPANSION_LIMIT} occurrences.`],
    actions: [
      {
        type: "bulk_create_discrete_tasks",
        title: title.title,
        description: normalizeWhitespace(input.text),
        occurrences: occurrences.map((occurrence, index) => ({
          title: occurrences.length > 1 ? `${title.title} #${index + 1}` : title.title,
          reminderAt: occurrence.reminderAt ?? null,
          dueAt: null,
        })),
      },
    ],
    userFacingSummary: input.locale === "en" ? "I’ll create the recurring reminder tasks." : "我会创建重复提醒任务。",
  } satisfies AiIntentPlan
}

function buildRecurringSchedulePlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
}) {
  const clauses = splitClauses(input.text)
  const titleSource =
    clauses.find((clause) => /(写|做|背|练|看|读|学|跑|安排|schedule|practice|study|work on)/iu.test(clause))
    ?? input.text
  const title = extractTitle(titleSource, "schedule_subject")
  if (title.confidence < 0.95) return null
  const occurrences = buildOccurrencesFromRecurringSchedule(input.text, input.timeZone, input.now ?? new Date(), parseDurationMinutes(input.text, 30))
  const actions: AiIntentPlan["actions"] = []
  if (isDeadlineIntent(input.text)) {
    const dueAt = parseTimePoint(input.text, input.timeZone, input.now ?? new Date(), { dateOnlyAsEndOfDay: true })
    actions.push({
      type: "upsert_task",
      title: title.title,
      description: normalizeWhitespace(input.text),
      status: "TODO",
      priority: "MEDIUM",
      dueAt: dueAt.at.toISOString(),
      matchStrategy: "normalized_title",
      targetQuery: title.title,
      sourceText: input.text,
    })
  }
  actions.push({
    type: "create_recurring_schedule",
    taskTitle: title.title,
    taskQuery: title.title,
    createTaskIfMissing: true,
    taskDescriptionIfCreate: normalizeWhitespace(input.text),
    occurrences,
  })
  return {
    mode: "execute",
    confidence: 0.98,
    intentSummary: "Recurring scheduled work sessions",
    assumptions: [`Expanded to at most ${RECURRING_EXPANSION_LIMIT} schedule occurrences.`],
    actions,
    userFacingSummary: input.locale === "en" ? "I’ll set up recurring scheduled sessions." : "我会建立重复的计划时段。",
  } satisfies AiIntentPlan
}

export function buildDeterministicPlan(input: {
  text: string
  locale: "zh-Hans" | "en"
  timeZone: string
  now?: Date
  routeKind?: AiRouteKind
}): AiIntentPlan | null {
  const text = normalizeWhitespace(input.text)
  const now = input.now ?? new Date()
  const clauses = splitClauses(text)

  if (!text) return null

  if (/(清除所有规划|清除所有安排|清除所有日程|清空未来安排|clear all schedules|clear all planning)/iu.test(text)) {
    return {
      mode: "execute",
      confidence: 0.99,
      intentSummary: "Clear future scheduled blocks without deleting tasks or notes",
      assumptions: ["Default destructive schedule semantics only remove future time blocks."],
      actions: [
        {
          type: "clear_future_time_blocks",
          scope: "all_tasks",
          preserveTasks: true,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll clear future scheduled blocks and keep tasks and notes intact." : "我会清除未来的安排，但保留任务和笔记本身。",
    }
  }

  if (/(删除所有任务|清空待办|delete all tasks|clear all tasks)/iu.test(text)) {
    return {
      mode: "execute",
      confidence: 0.96,
      intentSummary: "Delete tasks in scope",
      assumptions: [],
      actions: [
        {
          type: "delete_tasks_in_scope",
          scope: "all",
          archiveInsteadOfDelete: false,
        },
      ],
      userFacingSummary: input.locale === "en" ? "I’ll delete the tasks you explicitly asked to remove." : "我会删除你明确要求删除的任务。",
    }
  }

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
  if (isCancelOccurrenceIntent(text) && /(明天|今天|后天|周[一二三四五六日天]|今晚|晚上|中午|下午|早上|am|pm)/iu.test(text)) {
    const beforeCancel = text.split(/取消/u)[1] ?? text
    const title = extractTitle(beforeCancel, "task")
    if (title.confidence >= 0.95) {
      return {
        mode: "execute",
        confidence: 0.95,
        intentSummary: "Delete an existing occurrence",
        assumptions: [],
        actions: [
          {
            type: "delete_time_block",
            timeBlockQuery: title.title,
            taskQuery: title.title,
            dateHint: text,
            timeHint: text,
          },
        ],
        userFacingSummary: input.locale === "en" ? "I’ll cancel that scheduled occurrence." : "我会取消对应的安排。",
      }
    }
  }

  if (isRescheduleIntent(text)) {
    const [targetPart, destinationPart] = text.split(/改到|挪到|移到|改成/u)
    const title = extractTitle(targetPart ?? text, "task")
    if (title.confidence >= 0.95 && destinationPart) {
      const newStart = parseTimePoint(destinationPart, input.timeZone, now, {
        defaultHour: COARSE_TIME_MAP.afternoon.hour,
        defaultMinute: COARSE_TIME_MAP.afternoon.minute,
      })
      const endAt = new Date(newStart.at.getTime() + parseDurationMinutes(destinationPart, 30) * 60000)
      return {
        mode: "execute",
        confidence: 0.95,
        intentSummary: "Move an existing time block",
        assumptions: [],
        actions: [
          {
            type: "move_time_block",
            timeBlockQuery: title.title,
            taskQuery: title.title,
            fromDateHint: text,
            fromTimeHint: text,
            newStartAt: newStart.at.toISOString(),
            newEndAt: endAt.toISOString(),
          },
        ],
        userFacingSummary: input.locale === "en" ? "I’ll move that scheduled block." : "我会调整对应的安排时间。",
      }
    }
  }

  if (recurringWindow && /每天|every day/iu.test(text)) {
    if (isReminderIntent(text) || /吃药|缴费|打电话|医院/u.test(text)) {
      return buildRecurringReminderPlan(input)
    }
    return buildRecurringSchedulePlan(input)
  }

  const noteClause = clauses.find((clause) => isIdeaLike(clause))
  const actionClause = clauses.find((clause) => clause !== noteClause && isActionLike(clause))
  if (noteClause && actionClause) {
    const extracted = extractTitle(actionClause, "task")
    if (extracted.confidence < 0.95) return null
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
          title: extracted.title,
          description: actionClause,
          status: "TODO",
          priority: "MEDIUM",
          reminderAt: reminder?.at.toISOString() ?? null,
          matchStrategy: "normalized_title",
          targetQuery: extracted.title,
          sourceText: actionClause,
        },
        {
          type: "upsert_note",
          title: deriveNoteTitle(noteClause),
          summary: buildNoteSummary(noteClause),
          contentMd: buildNoteContent(noteClause),
          typeHint: "OTHER",
          importance: "MEDIUM",
          relatedTaskTitles: [extracted.title],
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
    if (isWorkSessionVerb(text) || hasExplicitExecutionTime(text) || hasCoarseExecutionSlot(text)) {
      return buildSchedulePlan(input)
    }
    return buildSchedulePlan(input)
  }

  if (isDeadlineIntent(text)) {
    return buildDeadlinePlan(input)
  }

  if (isReminderIntent(text)) {
    return buildReminderPlan(input)
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
  const heuristic = buildDeterministicPlan({
    text: latestUserMessage,
    locale: input.locale,
    timeZone: input.timeZone,
    routeKind: "FULL_PLANNER",
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
