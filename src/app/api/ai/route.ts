import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const API_KEY = process.env.OPENAI_API_KEY!
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

/* ── Action tool definitions (read-only data is pre-loaded into system prompt) ── */

const actionTools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "创建新任务",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题" },
          description: { type: "string", description: "任务描述" },
          status: { type: "string", enum: ["TODO", "DOING", "DONE"], description: "默认TODO" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "默认MEDIUM" },
          dueAt: { type: "string", description: "截止日期 ISO 8601（必须带时区偏移）" },
          estimateMinutes: { type: "number", description: "预估分钟" },
          tagIds: { type: "array", items: { type: "string" }, description: "标签ID数组" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "更新任务",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务ID" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: "string", description: "ISO 8601，传 null 清除" },
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
      description: "删除任务（同时删除其所有时间块）",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_time_block",
      description: "为任务创建单个时间块",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startAt: { type: "string", description: "ISO 8601（必须带时区偏移）" },
          endAt: { type: "string", description: "ISO 8601（必须带时区偏移）" },
        },
        required: ["taskId", "startAt", "endAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_recurring_time_blocks",
      description: "批量创建重复时间块。用于每天/每周X的重复排期。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startTime: { type: "string", description: "每天开始 HH:MM" },
          endTime: { type: "string", description: "每天结束 HH:MM" },
          startDate: { type: "string", description: "第一天 YYYY-MM-DD" },
          endDate: { type: "string", description: "最后一天 YYYY-MM-DD（与repeatDays二选一）" },
          repeatDays: { type: "number", description: "重复天数（与endDate二选一，最大90）" },
          daysOfWeek: { type: "array", items: { type: "number" }, description: "星期几(0=日..6=六)，不填=每天" },
        },
        required: ["taskId", "startTime", "endTime", "startDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_time_block",
      description: "删除单个时间块",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_time_blocks_for_task",
      description: "删除某任务的所有时间块",
      parameters: {
        type: "object",
        properties: { taskId: { type: "string" } },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_future_time_blocks",
      description: "删除从某个时间点之后的所有时间块。用于「清空以后所有规划」「删掉未来所有安排」等。可指定某个任务或所有任务。",
      parameters: {
        type: "object",
        properties: {
          afterDate: { type: "string", description: "从此时间之后（含）的时间块会被删除，ISO 8601。不填则从现在开始。" },
          taskId: { type: "string", description: "只删除该任务的。不填则删除所有任务的。" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "查询笔记列表",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "创建笔记",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          contentMd: { type: "string", description: "Markdown正文" },
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
      description: "更新笔记",
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
      description: "删除笔记",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tag",
      description: "创建标签",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string", description: "hex颜色，默认#6366f1" },
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
      description: "添加到收件箱",
      parameters: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
      },
    },
  },
]

/* ── Tool execution ── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled"
}

function revalidateAll() {
  for (const p of ["/tasks", "/today", "/timeline", "/ddl", "/inbox", "/notes", "/tags"]) {
    revalidatePath(p)
  }
}

async function executeTool(name: string, args: Record<string, unknown>, tz: string, userId: string): Promise<string> {
  try {
    switch (name) {
      case "create_task": {
        const task = await prisma.task.create({
          data: {
            userId,
            title: args.title as string,
            description: (args.description as string) || undefined,
            status: (args.status as any) || "TODO",
            priority: (args.priority as any) || "MEDIUM",
            dueAt: args.dueAt ? new Date(args.dueAt as string) : null,
            estimateMinutes: (args.estimateMinutes as number) || null,
            taskTags: (args.tagIds as string[])?.length
              ? { create: (args.tagIds as string[]).map(tagId => ({ tagId })) }
              : undefined,
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: task.id, title: task.title })
      }

      case "update_task": {
        const { id, tagIds, dueAt, ...rest } = args as any
        const task = await prisma.task.update({
          where: { id, userId },
          data: {
            ...rest,
            dueAt: dueAt !== undefined ? (dueAt ? new Date(dueAt) : null) : undefined,
            completedAt: rest.status === "DONE" ? new Date() : rest.status ? null : undefined,
            ...(tagIds !== undefined && {
              taskTags: { deleteMany: {}, create: tagIds.map((tagId: string) => ({ tagId })) },
            }),
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: task.id, title: task.title, status: task.status })
      }

      case "delete_task": {
        await prisma.task.delete({ where: { id: args.id as string, userId } })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "create_time_block": {
        const block = await prisma.timeBlock.create({
          data: {
            taskId: args.taskId as string,
            startAt: new Date(args.startAt as string),
            endAt: new Date(args.endAt as string),
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: block.id })
      }

      case "create_recurring_time_blocks": {
        const { taskId, startTime, endTime, startDate, endDate, repeatDays, daysOfWeek } = args as {
          taskId: string; startTime: string; endTime: string; startDate: string
          endDate?: string; repeatDays?: number; daysOfWeek?: number[]
        }
        const [sy, sm, sd] = startDate.split("-").map(Number)
        const start = new Date(Date.UTC(sy, sm - 1, sd))
        let end: Date
        if (endDate) {
          const [ey, em, ed] = endDate.split("-").map(Number)
          end = new Date(Date.UTC(ey, em - 1, ed))
        } else {
          end = new Date(start.getTime() + (Math.min((repeatDays || 7), 90) - 1) * 86400000)
        }
        const off = tzOffset(tz)
        const allowedDays = daysOfWeek?.length ? daysOfWeek : undefined
        const blocks: { taskId: string; startAt: Date; endAt: Date }[] = []
        const cur = new Date(start)
        while (cur <= end) {
          if (!allowedDays || allowedDays.includes(cur.getUTCDay())) {
            const dateStr = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`
            blocks.push({
              taskId,
              startAt: new Date(`${dateStr}T${startTime}:00${off}`),
              endAt: new Date(`${dateStr}T${endTime}:00${off}`),
            })
          }
          cur.setUTCDate(cur.getUTCDate() + 1)
        }
        if (!blocks.length) return JSON.stringify({ error: "没有符合条件的日期" })
        await prisma.timeBlock.createMany({ data: blocks })
        revalidateAll()
        return JSON.stringify({ success: true, created: blocks.length })
      }

      case "delete_time_block": {
        await prisma.timeBlock.delete({ where: { id: args.id as string } })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "delete_all_time_blocks_for_task": {
        const result = await prisma.timeBlock.deleteMany({ where: { taskId: args.taskId as string } })
        revalidateAll()
        return JSON.stringify({ success: true, deleted: result.count })
      }

      case "delete_future_time_blocks": {
        const after = args.afterDate ? new Date(args.afterDate as string) : new Date()
        const where: any = { startAt: { gte: after } }
        if (args.taskId) {
          where.taskId = args.taskId as string
        } else {
          // Only delete blocks belonging to this user's tasks
          where.task = { userId }
        }
        const result = await prisma.timeBlock.deleteMany({ where })
        revalidateAll()
        return JSON.stringify({ success: true, deleted: result.count })
      }

      case "list_notes": {
        const where: Record<string, unknown> = { userId }
        if (args.type) where.type = args.type
        const notes = await prisma.note.findMany({
          where,
          include: { noteTags: { include: { tag: true } } },
          orderBy: { createdAt: "desc" },
          take: (args.limit as number) || 30,
        })
        return JSON.stringify(notes.map(n => ({
          id: n.id, title: n.title, summary: n.summary, type: n.type,
          tags: n.noteTags.map(nt => nt.tag.name),
        })))
      }

      case "create_note": {
        let slug = slugify(args.title as string)
        const existing = await prisma.note.findFirst({ where: { userId, slug } })
        if (existing) slug += `-${Date.now().toString(36)}`
        const note = await prisma.note.create({
          data: {
            userId,
            title: args.title as string,
            slug,
            summary: (args.summary as string) || "",
            contentMd: (args.contentMd as string) || "",
            type: (args.type as any) || "OTHER",
            importance: (args.importance as any) || "MEDIUM",
            noteTags: (args.tagIds as string[])?.length
              ? { create: (args.tagIds as string[]).map(tagId => ({ tagId })) }
              : undefined,
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: note.id, title: note.title })
      }

      case "update_note": {
        const { id, tagIds, ...rest } = args as any
        await prisma.note.update({
          where: { id, userId },
          data: {
            ...rest,
            ...(tagIds !== undefined && {
              noteTags: { deleteMany: {}, create: tagIds.map((tagId: string) => ({ tagId })) },
            }),
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "delete_note": {
        await prisma.note.delete({ where: { id: args.id as string, userId } })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "create_tag": {
        const tag = await prisma.tag.create({
          data: {
            userId,
            name: args.name as string,
            slug: slugify(args.name as string),
            color: (args.color as string) || "#6366f1",
            description: (args.description as string) || null,
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: tag.id, name: tag.name })
      }

      case "add_to_inbox": {
        const item = await prisma.inboxItem.create({
          data: { userId, content: args.content as string },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: item.id })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || String(err) })
  }
}

/* ── Timezone helpers ── */

function tzOffset(tz: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date())
  const offsetStr = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT"
  const match = offsetStr.match(/GMT([+-]\d+(?::\d+)?)?/)
  if (!match?.[1]) return "+00:00"
  const sign = match[1][0]
  const [h, m = "0"] = match[1].slice(1).split(":")
  return `${sign}${h.padStart(2, "0")}:${m.padStart(2, "0")}`
}

function getLocalDateStr(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`
}

function getTodayRange(tz: string): [Date, Date] {
  const todayStr = getLocalDateStr(tz)
  const off = tzOffset(tz)
  const start = new Date(`${todayStr}T00:00:00${off}`)
  const end = new Date(start.getTime() + 86400000)
  return [start, end]
}

/* ── System prompt builder ── */

function buildSystemPrompt(
  lang: "zh" | "en",
  tz: string,
  tasks: any[],
  tags: any[],
  todayBlocks: any[],
): string {
  const off = tzOffset(tz)
  const todayStr = getLocalDateStr(tz)
  const currentTime = new Date().toLocaleString(lang === "en" ? "en-US" : "zh-CN", {
    timeZone: tz, month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
  })

  const fmtTime = (d: Date) => new Date(d).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })

  const taskLines = tasks.map(t => {
    const p = [`${t.id}: ${t.title} [${t.status}/${t.priority}]`]
    if (t.dueAt) p.push(`DDL:${new Date(t.dueAt).toLocaleDateString("en-CA", { timeZone: tz, month: "numeric", day: "numeric" })}`)
    if (t.estimateMinutes) p.push(`est:${t.estimateMinutes}min`)
    if (t._count.timeBlocks > 0) p.push(`${t._count.timeBlocks}块`)
    if (t.taskTags.length) p.push(`#${t.taskTags.map((tt: any) => tt.tag.name).join(" #")}`)
    return `- ${p.join(" | ")}`
  }).join("\n")

  const blockLines = todayBlocks.map((b: any) =>
    `- [${b.id}] ${fmtTime(b.startAt)}-${fmtTime(b.endAt)} ${b.task.title}`
  ).join("\n")

  const tagLine = tags.map((t: any) => `${t.name}(${t.id})`).join(", ")

  if (lang === "zh") {
    return `你是 Sage AI 助手，帮用户管理任务、规划时间、记笔记。回复简洁。

## 规则
1. **禁止重复创建任务**：下面已列出所有任务。用户提到的事项若和已有任务相关（关键词重叠即匹配），直接操作已有任务（加时间块/改状态等），不要新建。
2. 重复排期（每天/每周X）用 create_recurring_time_blocks。
3. 所有时间必须带时区偏移量，如 "${todayStr}T19:00:00${off}"。

## 当前时间
${tz} (UTC${off}) | ${currentTime}

## 今日规划 (${todayStr})
${blockLines || "（无）"}

## 任务 (${tasks.length})
${taskLines || "（无）"}

## 标签
${tagLine || "（无）"}`
  }

  return `You are the Sage AI assistant. Help users manage tasks, schedule time, and take notes. Be concise.

## Rules
1. **Never create duplicate tasks**: All tasks are listed below. If user mentions something matching an existing task (any keyword overlap), operate on it directly — never create a new one.
2. Use create_recurring_time_blocks for repeating schedules.
3. All times must include timezone offset, e.g. "${todayStr}T19:00:00${off}".

## Current Time
${tz} (UTC${off}) | ${currentTime}

## Today's Schedule (${todayStr})
${blockLines || "(none)"}

## Tasks (${tasks.length})
${taskLines || "(none)"}

## Tags
${tagLine || "(none)"}`
}

/* ── GPT streaming ── */

interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

async function callGPTStreaming(
  messages: any[],
  tools: any[],
  onTextChunk: (text: string) => void,
): Promise<ToolCall[] | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages,
        tools,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ""
    let isToolResponse = false
    const toolCallsMap = new Map<number, ToolCall>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      sseBuffer += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = sseBuffer.indexOf("\n")) !== -1) {
        const line = sseBuffer.slice(0, idx).trim()
        sseBuffer = sseBuffer.slice(idx + 1)

        if (!line.startsWith("data: ")) continue
        const payload = line.slice(6)
        if (payload === "[DONE]") continue

        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta
          if (!delta) continue

          if (delta.tool_calls) {
            isToolResponse = true
            for (const tc of delta.tool_calls) {
              const i = tc.index ?? 0
              if (tc.id) {
                toolCallsMap.set(i, {
                  id: tc.id,
                  function: { name: tc.function?.name || "", arguments: tc.function?.arguments || "" },
                })
              } else {
                const existing = toolCallsMap.get(i)
                if (existing) {
                  if (tc.function?.name) existing.function.name += tc.function.name
                  if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
                }
              }
            }
          }

          if (delta.content && !isToolResponse) {
            onTextChunk(delta.content)
          }
        } catch { /* skip malformed */ }
      }
    }

    if (isToolResponse && toolCallsMap.size > 0) {
      return Array.from(toolCallsMap.values())
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/* ── POST handler ── */

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const userId = await getCurrentUserId()
  const { messages, locale, timezone } = await req.json()
  if (!messages?.length) {
    return NextResponse.json({ error: "无效请求" }, { status: 400 })
  }

  const tz = (typeof timezone === "string" && timezone) ? timezone : "Asia/Shanghai"
  const lang: "zh" | "en" = locale === "en" ? "en" : "zh"

  // Pre-fetch user data — eliminates the need for list_tasks/list_tags tool calls
  const [todayStart, todayEnd] = getTodayRange(tz)
  const [dbTasks, dbTags, dbTodayBlocks] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { notIn: ["ARCHIVED"] } },
      include: {
        taskTags: { include: { tag: { select: { id: true, name: true } } } },
        _count: { select: { timeBlocks: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: {
        task: { userId },
        startAt: { gte: todayStart, lt: todayEnd },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startAt: "asc" },
    }),
  ])

  const systemPrompt = buildSystemPrompt(lang, tz, dbTasks, dbTags, dbTodayBlocks)
  const fullMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages]

  // Stream response to client
  const stream = new ReadableStream({
    async start(ctrl) {
      const encoder = new TextEncoder()
      try {
        let iterations = 5
        while (iterations-- > 0) {
          const toolCalls = await callGPTStreaming(
            fullMessages,
            actionTools,
            (text) => ctrl.enqueue(encoder.encode(text)),
          )

          if (!toolCalls) {
            // Text response was streamed to client
            ctrl.close()
            return
          }

          // Add assistant tool_calls message
          fullMessages.push({
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function" as const, function: tc.function })),
          })

          // Execute all tool calls in parallel
          const results = await Promise.all(
            toolCalls.map(async (tc) => {
              const args = JSON.parse(tc.function.arguments || "{}")
              const result = await executeTool(tc.function.name, args, tz, userId)
              return { role: "tool" as const, tool_call_id: tc.id, content: result }
            })
          )
          fullMessages.push(...results)
        }

        ctrl.enqueue(encoder.encode(lang === "zh" ? "步骤过多，请简化请求。" : "Too many steps."))
        ctrl.close()
      } catch (err: any) {
        const msg = `${lang === "zh" ? "出错了" : "Error"}: ${err.message}`
        ctrl.enqueue(encoder.encode(msg))
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
