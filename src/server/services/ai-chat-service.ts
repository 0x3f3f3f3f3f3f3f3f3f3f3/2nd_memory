import { prisma } from "@/lib/prisma"
import {
  createInboxItem,
} from "@/server/services/inbox-service"
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "@/server/services/notes-service"
import {
  createTag,
} from "@/server/services/tags-service"
import {
  createTask,
  updateTask,
  deleteTask,
  createTimeBlock,
  deleteTimeBlock,
} from "@/server/services/tasks-service"
import { normalizeTimeZone, timeZoneOffsetString, zonedDayRange } from "@/server/time"
import { addDays } from "date-fns"
import { TZDate } from "@date-fns/tz"

const API_KEY = process.env.OPENAI_API_KEY!
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

const actionTools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["TODO", "DOING", "DONE"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: "string" },
          estimateMinutes: { type: "number" },
          tagIds: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: "string" },
          estimateMinutes: { type: "number" },
          tagIds: { type: "array", items: { type: "string" } },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_time_block",
      description: "Create one time block for a task",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startAt: { type: "string" },
          endAt: { type: "string" },
        },
        required: ["taskId", "startAt", "endAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_recurring_time_blocks",
      description: "Create repeated time blocks for a task",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          repeatDays: { type: "number" },
          daysOfWeek: { type: "array", items: { type: "number" } },
        },
        required: ["taskId", "startTime", "endTime", "startDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_time_block",
      description: "Delete one time block",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_time_blocks_for_task",
      description: "Delete all time blocks for a task",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_future_time_blocks",
      description: "Delete future time blocks, optionally scoped to one task",
      parameters: {
        type: "object",
        properties: {
          afterDate: { type: "string" },
          taskId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List notes",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a note",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          contentMd: { type: "string" },
          type: { type: "string", enum: ["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"] },
          importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          tagIds: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description: "Update a note",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          contentMd: { type: "string" },
          type: { type: "string", enum: ["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"] },
          importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          tagIds: { type: "array", items: { type: "string" } },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Delete a note",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tag",
      description: "Create a tag",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string" },
          description: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_inbox",
      description: "Add a capture to inbox",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
        },
        required: ["content"],
      },
    },
  },
]

function hasExplicitDeadlineIntent(text: string) {
  const normalized = text.toLowerCase()
  const deadlinePatterns = [
    /\bddl\b/,
    /\bdue\b/,
    /\bdue date\b/,
    /\bdeadline\b/,
    /\bby\s+\d/,
    /\bby\s+(today|tonight|tomorrow|tmr|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    /\bbefore\b/,
    /截止/,
    /截至/,
    /到期/,
    /最晚/,
    /之前/,
    /前完成/,
    /前交/,
    /前提交/,
    /前做完/,
    /交付时间/,
    /截止日期/,
  ]

  return deadlinePatterns.some((pattern) => pattern.test(normalized))
}

function hasMutationIntent(text: string) {
  const normalized = text.toLowerCase()
  const patterns = [
    /\b(create|add|new|delete|remove|update|edit|schedule|plan|mark|complete)\b/,
    /创建/,
    /新建/,
    /添加/,
    /加一个/,
    /加上/,
    /删除/,
    /移除/,
    /更新/,
    /修改/,
    /安排/,
    /排期/,
    /提醒/,
    /标记/,
    /完成/,
    /收件箱/,
    /任务/,
    /笔记/,
    /标签/,
  ]

  return patterns.some((pattern) => pattern.test(normalized))
}

function inferDueAtFromMessage(text: string, timeZone: string) {
  const raw = text.trim()
  const normalized = raw.toLowerCase()

  let dayOffset: number | null = null
  if (/后天/.test(raw) || /day after tomorrow/.test(normalized)) {
    dayOffset = 2
  } else if (/明天|明早|明晚/.test(raw) || /\btomorrow\b/.test(normalized)) {
    dayOffset = 1
  } else if (/今天|今晚|今早/.test(raw) || /\btoday\b|\btonight\b/.test(normalized)) {
    dayOffset = 0
  }

  const time = inferTimeFromMessage(raw, normalized)

  if (dayOffset === null && time === null) {
    return null
  }

  const base = TZDate.tz(timeZone)
  const target = addDays(base, dayOffset ?? 0)
  const hour = time?.hour ?? 23
  const minute = time?.minute ?? 59

  const dueAt = new TZDate(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    hour,
    minute,
    0,
    timeZone,
  )

  return dueAt.toISOString()
}

function inferTimeFromMessage(raw: string, normalized: string) {
  if (/中午/.test(raw) && !/\d/.test(raw)) {
    return { hour: 12, minute: 0 }
  }
  if (/noon/.test(normalized)) {
    return { hour: 12, minute: 0 }
  }
  if (/midnight/.test(normalized)) {
    return { hour: 0, minute: 0 }
  }

  const zhMatch = raw.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})(?:点|时)(半|(\d{1,2})分?)?/)
  if (zhMatch) {
    const meridiem = zhMatch[1] ?? ""
    let hour = Number(zhMatch[2])
    const minute = zhMatch[3] === "半" ? 30 : zhMatch[4] ? Number(zhMatch[4]) : 0

    if (/下午|晚上/.test(meridiem) && hour < 12) hour += 12
    if (/凌晨/.test(meridiem) && hour === 12) hour = 0
    if (/中午/.test(meridiem) && hour < 11) hour += 12
    if (/中午/.test(meridiem) && hour === 12) hour = 12

    return { hour, minute }
  }

  const enMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (enMatch) {
    let hour = Number(enMatch[1])
    const minute = enMatch[2] ? Number(enMatch[2]) : 0
    const meridiem = enMatch[3]
    if (meridiem === "pm" && hour < 12) hour += 12
    if (meridiem === "am" && hour === 12) hour = 0
    return { hour, minute }
  }

  const plainHourMatch = raw.match(/(\d{1,2})点前?/) ?? normalized.match(/\b(\d{1,2})\b/)
  if (plainHourMatch && /前|before|by|截止|截至|到期|ddl|deadline|due/.test(raw + normalized)) {
    return { hour: Number(plainHourMatch[1]), minute: 0 }
  }

  return null
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  input: {
    userId: string
    timeZone: string
    allowDueAt: boolean
    inferredDueAt: string | null
    onMutation?: () => void
  },
) {
  switch (name) {
    case "create_task": {
      const task = await createTask(input.userId, {
        title: String(args.title),
        description: typeof args.description === "string" ? args.description : null,
        status: (args.status as "TODO" | "DOING" | "DONE" | undefined) ?? "TODO",
        priority: (args.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined) ?? "MEDIUM",
        dueAt:
          input.allowDueAt
            ? typeof args.dueAt === "string"
              ? args.dueAt
              : input.inferredDueAt
            : null,
        estimateMinutes: typeof args.estimateMinutes === "number" ? args.estimateMinutes : null,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : [],
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, id: task.id, title: task.title })
    }
    case "update_task": {
      const task = await updateTask(input.userId, String(args.id), {
        title: typeof args.title === "string" ? args.title : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        status: typeof args.status === "string" ? (args.status as never) : undefined,
        priority: typeof args.priority === "string" ? (args.priority as never) : undefined,
        dueAt:
          "dueAt" in args
            ? input.allowDueAt && typeof args.dueAt === "string"
              ? args.dueAt
              : null
            : input.allowDueAt && input.inferredDueAt
            ? input.inferredDueAt
            : undefined,
        estimateMinutes: typeof args.estimateMinutes === "number" ? args.estimateMinutes : undefined,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : undefined,
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, id: task.id, title: task.title, status: task.status })
    }
    case "delete_task": {
      await deleteTask(input.userId, String(args.id))
      input.onMutation?.()
      return JSON.stringify({ success: true })
    }
    case "create_time_block": {
      const block = await createTimeBlock(input.userId, String(args.taskId), {
        startAt: String(args.startAt),
        endAt: String(args.endAt),
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, id: block.id })
    }
    case "create_recurring_time_blocks": {
      const taskId = String(args.taskId)
      const startTime = String(args.startTime)
      const endTime = String(args.endTime)
      const startDate = String(args.startDate)
      const endDate = typeof args.endDate === "string" ? args.endDate : null
      const repeatDays = typeof args.repeatDays === "number" ? Math.min(args.repeatDays, 90) : 7
      const daysOfWeek = Array.isArray(args.daysOfWeek) ? (args.daysOfWeek as number[]) : null
      const offset = timeZoneOffsetString(input.timeZone)

      const firstDay = new Date(`${startDate}T00:00:00${offset}`)
      const lastDay = endDate ? new Date(`${endDate}T00:00:00${offset}`) : new Date(firstDay.getTime() + (repeatDays - 1) * 86400000)

      let cursor = new Date(firstDay)
      let created = 0
      while (cursor <= lastDay) {
        const utcDay = cursor.getUTCDay()
        if (!daysOfWeek || daysOfWeek.includes(utcDay)) {
          const dateString = cursor.toISOString().slice(0, 10)
          await createTimeBlock(input.userId, taskId, {
            startAt: `${dateString}T${startTime}:00${offset}`,
            endAt: `${dateString}T${endTime}:00${offset}`,
          })
          created += 1
        }
        cursor = new Date(cursor.getTime() + 86400000)
      }
      input.onMutation?.()
      return JSON.stringify({ success: true, created })
    }
    case "delete_time_block": {
      await deleteTimeBlock(input.userId, String(args.id))
      input.onMutation?.()
      return JSON.stringify({ success: true })
    }
    case "delete_all_time_blocks_for_task": {
      const result = await prisma.timeBlock.deleteMany({
        where: {
          taskId: String(args.taskId),
          task: { userId: input.userId },
        },
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, deleted: result.count })
    }
    case "delete_future_time_blocks": {
      const after = typeof args.afterDate === "string" ? new Date(args.afterDate) : new Date()
      const result = await prisma.timeBlock.deleteMany({
        where: {
          startAt: { gte: after },
          ...(typeof args.taskId === "string"
            ? { taskId: args.taskId, task: { userId: input.userId } }
            : { task: { userId: input.userId } }),
        },
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, deleted: result.count })
    }
    case "list_notes": {
      const notes = await listNotes(input.userId, {
        type: typeof args.type === "string" ? args.type : null,
      })
      const limited = notes.slice(0, typeof args.limit === "number" ? args.limit : 30)
      return JSON.stringify(
        limited.map((note) => ({
          id: note.id,
          title: note.title,
          summary: note.summary,
          type: note.type,
          tags: note.noteTags.map(({ tag }) => tag.name),
        })),
      )
    }
    case "create_note": {
      const note = await createNote(input.userId, {
        title: String(args.title),
        summary: typeof args.summary === "string" ? args.summary : "",
        contentMd: typeof args.contentMd === "string" ? args.contentMd : "",
        type: (typeof args.type === "string" ? args.type : "OTHER") as never,
        importance: (typeof args.importance === "string" ? args.importance : "MEDIUM") as never,
        isPinned: false,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : [],
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, id: note.id, title: note.title })
    }
    case "update_note": {
      await updateNote(input.userId, String(args.id), {
        title: typeof args.title === "string" ? args.title : undefined,
        summary: typeof args.summary === "string" ? args.summary : undefined,
        contentMd: typeof args.contentMd === "string" ? args.contentMd : undefined,
        type: typeof args.type === "string" ? (args.type as never) : undefined,
        importance: typeof args.importance === "string" ? (args.importance as never) : undefined,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : undefined,
      })
      input.onMutation?.()
      return JSON.stringify({ success: true })
    }
    case "delete_note": {
      await deleteNote(input.userId, String(args.id))
      input.onMutation?.()
      return JSON.stringify({ success: true })
    }
    case "create_tag": {
      const tag = await createTag(input.userId, {
        name: String(args.name),
        color: typeof args.color === "string" ? args.color : "#6366f1",
        description: typeof args.description === "string" ? args.description : null,
      })
      input.onMutation?.()
      return JSON.stringify({ success: true, id: tag.id, name: tag.name })
    }
    case "add_to_inbox": {
      const item = await createInboxItem(input.userId, String(args.content))
      input.onMutation?.()
      return JSON.stringify({ success: true, id: item.id })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

function buildSystemPrompt(
  language: "zh-Hans" | "en",
  timeZone: string,
  tasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    dueAt: Date | null
    estimateMinutes: number | null
    taskTags: Array<{ tag: { name: string } }>
  }>,
  tags: Array<{ id: string; name: string; color: string }>,
  todayBlocks: Array<{
    id: string
    startAt: Date
    endAt: Date
    task: { title: string }
  }>,
) {
  const offset = timeZoneOffsetString(timeZone)
  const now = new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    timeZone,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())

  const taskLines = tasks.map((task) => {
    const parts = [`${task.id}: ${task.title} [${task.status}/${task.priority}]`]
    if (task.dueAt) {
      parts.push(`due:${new Date(task.dueAt).toLocaleDateString("en-CA", { timeZone })}`)
    }
    if (task.estimateMinutes) {
      parts.push(`est:${task.estimateMinutes}min`)
    }
    if (task.taskTags.length) {
      parts.push(`#${task.taskTags.map(({ tag }) => tag.name).join(" #")}`)
    }
    return `- ${parts.join(" | ")}`
  }).join("\n")

  const blockLines = todayBlocks.map((block) => {
    const start = new Date(block.startAt).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
    const end = new Date(block.endAt).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
    return `- [${block.id}] ${start}-${end} ${block.task.title}`
  }).join("\n")

  const tagLine = tags.map((tag) => `${tag.name}(${tag.id})`).join(", ")

  if (language === "zh-Hans") {
    return `你是 Sage AI 助手，帮助用户管理任务、规划时间、记录笔记。回复简洁。

规则：
1. 不要重复创建明显已存在的任务。
2. 只要用户明确要求创建、修改、删除、排期、转化任务/笔记，你必须调用工具，不能只口头说“已创建/已修改”。
3. 如果用户明确给了截止时间或“明天中午12点前 / tomorrow before 12pm”这类表达，你必须在 create_task / update_task 中带上 dueAt，不能让任务保持未排期。
4. 如果用户没有明确说截止时间，不要擅自填写 dueAt。
5. 所有时间都必须带时区偏移，例如 2026-03-25T19:00:00${offset}。

当前时间：
${timeZone} (UTC${offset}) | ${now}

今日时间块：
${blockLines || "（无）"}

任务：
${taskLines || "（无）"}

标签：
${tagLine || "（无）"}`
  }

  return `You are the Sage AI assistant. Help the user manage tasks, schedule time, and write notes. Be concise.

Rules:
1. Do not create obvious duplicate tasks.
2. If the user asks to create, update, delete, schedule, or convert anything, you must use tools before claiming success.
3. If the user explicitly gives a deadline such as “tomorrow before 12pm”, you must include dueAt in create_task / update_task. Do not leave the task unscheduled.
4. Do not set dueAt unless the user explicitly gave a deadline.
5. All timestamps must include timezone offsets, for example 2026-03-25T19:00:00${offset}.

Current time:
${timeZone} (UTC${offset}) | ${now}

Today's time blocks:
${blockLines || "(none)"}

Tasks:
${taskLines || "(none)"}

Tags:
${tagLine || "(none)"}`
}

interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

async function callGPTStreaming(
  messages: unknown[],
  onTextChunk: (text: string) => void,
  options?: { requireToolUse?: boolean },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages,
        tools: actionTools,
        ...(options?.requireToolUse ? { tool_choice: "required" } : {}),
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let isToolResponse = false
    const toolCalls = new Map<number, ToolCall>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let lineBreakIndex = -1
      while ((lineBreakIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, lineBreakIndex).trim()
        buffer = buffer.slice(lineBreakIndex + 1)
        if (!line.startsWith("data: ")) continue
        const payload = line.slice(6)
        if (payload === "[DONE]") continue

        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta
          if (!delta) continue

          if (delta.tool_calls) {
            isToolResponse = true
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index ?? 0
              if (toolCall.id) {
                toolCalls.set(index, {
                  id: toolCall.id,
                  function: {
                    name: toolCall.function?.name || "",
                    arguments: toolCall.function?.arguments || "",
                  },
                })
              } else {
                const existing = toolCalls.get(index)
                if (existing) {
                  if (toolCall.function?.name) existing.function.name += toolCall.function.name
                  if (toolCall.function?.arguments) existing.function.arguments += toolCall.function.arguments
                }
              }
            }
          }

          if (delta.content && !isToolResponse) {
            onTextChunk(delta.content)
          }
        } catch {
          continue
        }
      }
    }

    if (isToolResponse && toolCalls.size > 0) {
      return Array.from(toolCalls.values())
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function streamAiChat(input: {
  userId: string
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: AiChatMessage[]
  onMutation?: () => void
}) {
  const effectiveTimeZone = normalizeTimeZone(input.timeZone?.trim?.() ?? input.timeZone, "UTC")
  const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content
  const inferredDueAt = typeof lastUserMessage === "string" ? inferDueAtFromMessage(lastUserMessage, effectiveTimeZone) : null
  const allowDueAt = typeof lastUserMessage === "string"
    ? hasExplicitDeadlineIntent(lastUserMessage) || inferredDueAt !== null
    : false
  const requireToolUse = typeof lastUserMessage === "string" ? hasMutationIntent(lastUserMessage) : false
  const { start, end } = zonedDayRange(effectiveTimeZone)

  const [tasks, tags, todayBlocks] = await Promise.all([
    prisma.task.findMany({
      where: { userId: input.userId, status: { not: "ARCHIVED" } },
      include: {
        taskTags: { include: { tag: { select: { id: true, name: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.tag.findMany({
      where: { userId: input.userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: {
        task: { userId: input.userId },
        startAt: { gte: start, lt: end },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startAt: "asc" },
    }),
  ])

  const fullMessages: unknown[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.locale, effectiveTimeZone, tasks, tags, todayBlocks),
    },
    ...input.messages,
  ]

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        let steps = 5
        let isFirstIteration = true
        while (steps-- > 0) {
          const toolCalls = await callGPTStreaming(
            fullMessages,
            (text) => {
              controller.enqueue(encoder.encode(text))
            },
            { requireToolUse: requireToolUse && isFirstIteration },
          )
          isFirstIteration = false

          if (!toolCalls) {
            controller.close()
            return
          }

          fullMessages.push({
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function" as const,
              function: toolCall.function,
            })),
          })

          const results = await Promise.all(
            toolCalls.map(async (toolCall) => {
              const args = JSON.parse(toolCall.function.arguments || "{}")
              const result = await executeTool(toolCall.function.name, args, {
                userId: input.userId,
                timeZone: effectiveTimeZone,
                allowDueAt,
                inferredDueAt,
                onMutation: input.onMutation,
              })
              return {
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: result,
              }
            }),
          )

          fullMessages.push(...results)
        }

        controller.enqueue(
          encoder.encode(input.locale === "en" ? "Too many steps. Please simplify the request." : "步骤过多，请简化请求。"),
        )
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        controller.enqueue(
          encoder.encode(input.locale === "en" ? `Error: ${message}` : `出错了：${message}`),
        )
        controller.close()
      }
    },
  })
}
