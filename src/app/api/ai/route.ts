import { NextRequest, NextResponse } from "next/server"
import { isAuthenticated, OWNER_USER_ID } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const API_KEY = process.env.OPENAI_API_KEY!
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

async function chatCompletion(messages: any[], tools: any[]) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  return await res.json()
}

/* ── Tool definitions for GPT ── */

const tools = [
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "查询任务列表。可按状态、优先级筛选，返回任务的完整信息（含标签、子任务、时间块）。",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"], description: "按状态筛选" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "按优先级筛选" },
          limit: { type: "number", description: "返回数量上限，默认50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "创建新任务。可设置标题、描述、状态、优先级、截止日期(DDL)、预估时间等。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题（必填）" },
          description: { type: "string", description: "任务描述" },
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"], description: "状态，默认TODO" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "优先级，默认MEDIUM" },
          dueAt: { type: "string", description: "截止日期，ISO 8601 格式，如 2026-03-25T23:59:00" },
          estimateMinutes: { type: "number", description: "预估时间（分钟）" },
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
      description: "更新已有任务的信息。可修改任意字段。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务ID（必填）" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: "string", description: "截止日期 ISO 8601，传 null 清除" },
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
      description: "删除任务",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "任务ID" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_time_block",
      description: "为任务创建时间块（工作时段）。一个任务可有多个时间块，分布在不同天/时间。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "任务ID" },
          startAt: { type: "string", description: "开始时间 ISO 8601" },
          endAt: { type: "string", description: "结束时间 ISO 8601" },
        },
        required: ["taskId", "startAt", "endAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_recurring_time_blocks",
      description: "批量创建重复时间块。用于【每天/每周X】类型的重复排期，例如每天晚上8点半学习、每周一三五下午跑步。一次调用就能创建多个连续/周期时间块。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "任务ID（必填）" },
          startTime: { type: "string", description: "每天的开始时间，格式 HH:MM，例如 \"20:30\"" },
          endTime: { type: "string", description: "每天的结束时间，格式 HH:MM，例如 \"21:00\"" },
          startDate: { type: "string", description: "第一天日期，格式 YYYY-MM-DD，例如 \"2026-03-24\"" },
          endDate: { type: "string", description: "最后一天日期（含），格式 YYYY-MM-DD。与 repeatDays 二选一。" },
          repeatDays: { type: "number", description: "从 startDate 起重复几天（含当天）。与 endDate 二选一，最大 90。" },
          daysOfWeek: {
            type: "array",
            items: { type: "number" },
            description: "仅在这几个星期几创建（0=周日,1=周一,...,6=周六）。不填则每天都创建。例如 [1,3,5] 表示周一三五。",
          },
        },
        required: ["taskId", "startTime", "endTime", "startDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_time_block",
      description: "删除一个时间块",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "时间块ID" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "查询知识笔记列表",
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
      description: "创建知识笔记。用于记录建议、决策、人物、教训、健康、财务等各类知识。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "笔记标题（必填）" },
          summary: { type: "string", description: "摘要" },
          contentMd: { type: "string", description: "正文 Markdown" },
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
      description: "更新已有笔记",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "笔记ID（必填）" },
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
        properties: { id: { type: "string", description: "笔记ID" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tags",
      description: "获取所有标签及其关联数量",
      parameters: { type: "object", properties: {} },
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
          name: { type: "string", description: "标签名" },
          color: { type: "string", description: "颜色 hex，默认 #6366f1" },
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
      description: "添加到收件箱（快速捕获想法）",
      parameters: {
        type: "object",
        properties: { content: { type: "string", description: "内容" } },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_summary",
      description: "获取今日概览：今日到期任务、进行中任务、今日时间块、待复习笔记数",
      parameters: { type: "object", properties: {} },
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

async function executeTool(name: string, args: Record<string, unknown>, tz = "Asia/Shanghai"): Promise<string> {
  try {
    switch (name) {
      case "list_tasks": {
        const where: Record<string, unknown> = { userId: OWNER_USER_ID }
        if (args.status) where.status = args.status
        if (args.priority) where.priority = args.priority
        const tasks = await prisma.task.findMany({
          where,
          include: {
            taskTags: { include: { tag: true } },
            subTasks: true,
            timeBlocks: true,
          },
          orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
          take: (args.limit as number) || 50,
        })
        return JSON.stringify(tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt,
          estimateMinutes: t.estimateMinutes,
          isPinned: t.isPinned,
          tags: t.taskTags.map(tt => ({ id: tt.tag.id, name: tt.tag.name })),
          subTasks: t.subTasks.map(s => ({ id: s.id, title: s.title, done: s.done })),
          timeBlocks: t.timeBlocks.map(b => ({ id: b.id, startAt: b.startAt, endAt: b.endAt })),
          createdAt: t.createdAt,
        })))
      }

      case "create_task": {
        const task = await prisma.task.create({
          data: {
            userId: OWNER_USER_ID,
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
          include: { taskTags: { include: { tag: true } } },
        })
        revalidateAll()
        return JSON.stringify({ success: true, task: { id: task.id, title: task.title, status: task.status, priority: task.priority, dueAt: task.dueAt } })
      }

      case "update_task": {
        const { id, tagIds, dueAt, ...rest } = args as any
        const task = await prisma.task.update({
          where: { id, userId: OWNER_USER_ID },
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
        return JSON.stringify({ success: true, task: { id: task.id, title: task.title, status: task.status } })
      }

      case "delete_task": {
        await prisma.task.delete({ where: { id: args.id as string, userId: OWNER_USER_ID } })
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
        return JSON.stringify({ success: true, block: { id: block.id, startAt: block.startAt, endAt: block.endAt } })
      }

      case "create_recurring_time_blocks": {
        const { taskId, startTime, endTime, startDate, endDate, repeatDays, daysOfWeek } = args as {
          taskId: string; startTime: string; endTime: string; startDate: string
          endDate?: string; repeatDays?: number; daysOfWeek?: number[]
        }
        // Build list of dates (iterate in UTC; date strings are calendar dates)
        const [sy, sm, sd] = (startDate as string).split("-").map(Number)
        const start = new Date(Date.UTC(sy, sm - 1, sd))
        let end: Date
        if (endDate) {
          const [ey, em, ed] = (endDate as string).split("-").map(Number)
          end = new Date(Date.UTC(ey, em - 1, ed))
        } else {
          const days = Math.min((repeatDays as number) || 7, 90)
          end = new Date(start.getTime() + (days - 1) * 86400000)
        }
        // Get the user's timezone offset string (e.g. "+08:00") to build correct local times
        const tzOff = tzOffset(tz)
        // Treat empty array same as "every day" (no filter)
        const allowedDays = (daysOfWeek && daysOfWeek.length > 0) ? daysOfWeek : undefined
        const blocks: { taskId: string; startAt: Date; endAt: Date }[] = []
        const cur = new Date(start)
        while (cur <= end) {
          // cur is always midnight UTC; use UTC date components as the calendar date
          const dow = cur.getUTCDay()
          if (!allowedDays || allowedDays.includes(dow)) {
            const y = cur.getUTCFullYear()
            const mo = String(cur.getUTCMonth() + 1).padStart(2, "0")
            const d = String(cur.getUTCDate()).padStart(2, "0")
            const dateStr = `${y}-${mo}-${d}`
            // Construct times in the user's local timezone
            const s = new Date(`${dateStr}T${startTime}:00${tzOff}`)
            const e2 = new Date(`${dateStr}T${endTime}:00${tzOff}`)
            blocks.push({ taskId: taskId as string, startAt: s, endAt: e2 })
          }
          cur.setUTCDate(cur.getUTCDate() + 1)
        }
        if (blocks.length === 0) return JSON.stringify({ error: "没有符合条件的日期", debug: { startDate, endDate, repeatDays, daysOfWeek, startUTC: start.toISOString(), endUTC: end.toISOString() } })
        await prisma.timeBlock.createMany({ data: blocks })
        revalidateAll()
        return JSON.stringify({ success: true, created: blocks.length, firstBlock: blocks[0], lastBlock: blocks[blocks.length - 1] })
      }

      case "delete_time_block": {
        await prisma.timeBlock.delete({ where: { id: args.id as string } })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "list_notes": {
        const where: Record<string, unknown> = { userId: OWNER_USER_ID }
        if (args.type) where.type = args.type
        const notes = await prisma.note.findMany({
          where,
          include: { noteTags: { include: { tag: true } } },
          orderBy: { createdAt: "desc" },
          take: (args.limit as number) || 30,
        })
        return JSON.stringify(notes.map(n => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          type: n.type,
          importance: n.importance,
          tags: n.noteTags.map(nt => ({ id: nt.tag.id, name: nt.tag.name })),
          nextReviewAt: n.nextReviewAt,
          createdAt: n.createdAt,
        })))
      }

      case "create_note": {
        let slug = slugify(args.title as string)
        const existing = await prisma.note.findFirst({ where: { userId: OWNER_USER_ID, slug } })
        if (existing) slug += `-${Date.now().toString(36)}`
        const note = await prisma.note.create({
          data: {
            userId: OWNER_USER_ID,
            title: args.title as string,
            slug,
            summary: (args.summary as string) || "",
            contentMd: (args.contentMd as string) || "",
            type: (args.type as any) || "OTHER",
            importance: (args.importance as any) || "MEDIUM",
            nextReviewAt: new Date(Date.now() + 86400000),
            reviewIntervalDays: 1,
            noteTags: (args.tagIds as string[])?.length
              ? { create: (args.tagIds as string[]).map(tagId => ({ tagId })) }
              : undefined,
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, note: { id: note.id, title: note.title } })
      }

      case "update_note": {
        const { id, tagIds, ...rest } = args as any
        await prisma.note.update({
          where: { id, userId: OWNER_USER_ID },
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
        await prisma.note.delete({ where: { id: args.id as string, userId: OWNER_USER_ID } })
        revalidateAll()
        return JSON.stringify({ success: true })
      }

      case "list_tags": {
        const tags = await prisma.tag.findMany({
          where: { userId: OWNER_USER_ID },
          include: { _count: { select: { taskTags: true, noteTags: true } } },
          orderBy: { name: "asc" },
        })
        return JSON.stringify(tags.map(t => ({
          id: t.id, name: t.name, color: t.color, description: t.description,
          taskCount: t._count.taskTags, noteCount: t._count.noteTags,
        })))
      }

      case "create_tag": {
        const tag = await prisma.tag.create({
          data: {
            userId: OWNER_USER_ID,
            name: args.name as string,
            slug: slugify(args.name as string),
            color: (args.color as string) || "#6366f1",
            description: (args.description as string) || null,
          },
        })
        revalidateAll()
        return JSON.stringify({ success: true, tag: { id: tag.id, name: tag.name } })
      }

      case "add_to_inbox": {
        const item = await prisma.inboxItem.create({
          data: { userId: OWNER_USER_ID, content: args.content as string },
        })
        revalidateAll()
        return JSON.stringify({ success: true, id: item.id })
      }

      case "get_today_summary": {
        const now = new Date()
        // China timezone (UTC+8) - compute China midnight in UTC
        const chinaMs = now.getTime() + 8 * 3600000
        const chinaDate = new Date(chinaMs)
        const chinaMidnight = new Date(chinaDate.getFullYear(), chinaDate.getMonth(), chinaDate.getDate())
        const todayStart = new Date(chinaMidnight.getTime() - 8 * 3600000)
        const todayEnd = new Date(todayStart.getTime() + 86400000)

        const [dueTasks, doingTasks, todayBlocks, reviewCount] = await Promise.all([
          prisma.task.findMany({
            where: { userId: OWNER_USER_ID, dueAt: { gte: todayStart, lt: todayEnd }, status: { not: "DONE" } },
            select: { id: true, title: true, priority: true, dueAt: true, estimateMinutes: true },
          }),
          prisma.task.findMany({
            where: { userId: OWNER_USER_ID, status: "DOING" },
            select: { id: true, title: true, priority: true },
          }),
          prisma.timeBlock.findMany({
            where: { startAt: { gte: todayStart, lt: todayEnd } },
            include: { task: { select: { id: true, title: true } } },
          }),
          prisma.note.count({
            where: { userId: OWNER_USER_ID, nextReviewAt: { lte: now } },
          }),
        ])
        return JSON.stringify({
          date: todayStart.toISOString(),
          dueTasks,
          doingTasks,
          todayTimeBlocks: todayBlocks.map(b => ({
            id: b.id, taskId: b.task.id, taskTitle: b.task.title,
            startAt: b.startAt, endAt: b.endAt,
          })),
          pendingReviewCount: reviewCount,
        })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || String(err) })
  }
}

function revalidateAll() {
  for (const p of ["/tasks", "/today", "/timeline", "/ddl", "/inbox", "/notes", "/review", "/tags"]) {
    revalidatePath(p)
  }
}

/* ── Timezone helper ── */

function tzOffset(tz: string): string {
  // Use formatToParts to reliably get the UTC offset
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(now)
  const offsetStr = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT"
  // offsetStr is like "GMT+8", "GMT-5:30", "GMT+5:30", "GMT"
  const match = offsetStr.match(/GMT([+-]\d+(?::\d+)?)?/)
  if (!match || !match[1]) return "+00:00"
  const raw = match[1]
  const sign = raw[0]
  const [hStr, mStr = "0"] = raw.slice(1).split(":")
  const h = String(parseInt(hStr, 10)).padStart(2, "0")
  const m = String(parseInt(mStr, 10)).padStart(2, "0")
  return `${sign}${h}:${m}`
}

function getLocalDateStr(tz: string): string {
  // Returns "YYYY-MM-DD" in the given timezone without relying on Date parsing
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const y = parts.find(p => p.type === "year")?.value ?? "2000"
  const mo = parts.find(p => p.type === "month")?.value ?? "01"
  const d = parts.find(p => p.type === "day")?.value ?? "01"
  return `${y}-${mo}-${d}`
}

function buildTzSection(tz: string, locale: "zh" | "en"): string {
  const offset = tzOffset(tz)
  const now = new Date()
  const todayStr = getLocalDateStr(tz)
  const currentTime = now.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    timeZone: tz,
    year: "numeric", month: "long", day: "numeric",
    weekday: "long", hour: "2-digit", minute: "2-digit",
  })
  if (locale === "zh") {
    return `## ⚠️ 时区（极其重要）
- 用户时区为 **${tz}**（UTC${offset}）
- 所有日期时间**必须带上正确的时区偏移量**，例如：
  - "今天晚上7点到8点" → startAt: "${todayStr}T19:00:00${offset}", endAt: "${todayStr}T20:00:00${offset}"
  - "今天截止" → dueAt: "${todayStr}T23:59:00${offset}"
- **永远不要**使用不带时区的时间或 UTC 时间（如 "T19:00:00Z"），否则会导致时间错误
- 当前用户本地时间: ${currentTime}`
  } else {
    return `## ⚠️ Timezone (CRITICAL)
- The user's timezone is **${tz}** (UTC${offset})
- All datetimes **must include the correct timezone offset**, e.g.:
  - "tonight 7pm to 8pm" → startAt: "${todayStr}T19:00:00${offset}", endAt: "${todayStr}T20:00:00${offset}"
  - "due today" → dueAt: "${todayStr}T23:59:00${offset}"
- **Never** use timezone-naive times or UTC (e.g. "T19:00:00Z") — this causes time errors
- Current user local time: ${currentTime}`
  }
}

/* ── System prompts ── */

const SYSTEM_PROMPT_ZH = `你是「记忆花园」的 AI 助手。这是一个个人知识管理和任务规划系统。

你可以帮用户：
- 创建/修改/删除任务、安排时间块（工作时段）
- 创建/修改/删除知识笔记
- 管理标签
- 添加收件箱条目
- 查看今日概览、任务列表、笔记列表

## 数据模型概述

**任务 (Task)**
- status: INBOX(收件箱) / TODO(待办) / DOING(进行中) / DONE(完成) / ARCHIVED(归档)
- priority: LOW(低) / MEDIUM(中) / HIGH(高) / URGENT(紧急)
- dueAt: 截止日期 (DDL)
- estimateMinutes: 预估时间（分钟）
- 每个任务可以有多个 TimeBlock（工作时段），表示具体什么时间做这件事

**时间块 (TimeBlock)**
- 表示一个具体的工作时段 (startAt → endAt)
- 一个任务可以有多个时间块，分布在不同天
- 这是规划视图中拖拽排期的核心

**笔记 (Note)**
- type: ADVICE(建议) / DECISION(决策) / PERSON(人物) / LESSON(教训) / HEALTH(健康) / FINANCE(财务) / OTHER(其他)
- importance: LOW / MEDIUM / HIGH
- 笔记有间隔重复复习系统

**标签 (Tag)**: 可关联到任务或笔记

## 行为准则（极其重要，必须严格遵守）

### ⚠️ 绝对禁止重复创建任务（最高优先级规则）

**核心概念**：在本系统中，一个"任务"代表一件要做的事。用户说"今晚写物理IA"意思是在今晚安排时间去做"物理IA"这个任务，而**不是**要创建一个叫"写物理IA"的新任务。正确做法是给已有的"物理IA"任务添加 TimeBlock。

**强制流程——每次用户提到任何事项时都必须执行**：
1. **第一步永远是 list_tasks**。在做任何其他操作之前，先查看所有现有任务。
2. **极度宽松的模糊匹配**——只要有任何词语重叠或语义相关，就算匹配。关键词匹配优先于完整标题匹配：
   - "学习托福" / "托福练习" / "备考托福" → 全部匹配已有的 "托福"
   - "写物理IA" / "做物理IA" / "物理IA作业" → 全部匹配已有的 "物理IA"
   - "复习数学" / "做数学题" / "数学作业" → 全部匹配已有的 "数学"或"数学作业"
   - "去开会" / "开会" / "会议准备" → 全部匹配已有的 "开会"
   - **规则**：用户话语中的任何名词/关键词，只要在已有任务标题中出现，就是匹配。
3. **找到匹配 → 禁止创建新任务**。直接对已有任务操作：
   - 用户要安排时间 → create_time_block 或 create_recurring_time_blocks（用已有任务的 id）
   - 用户要改截止日期 → update_task
   - 用户要标记完成 → update_task status=DONE
4. **只有完全确认没有任何相似任务时**，才允许 create_task。

**违反此规则（创建了和已有任务重复的新任务）是最严重的错误。**

### 重复/周期排期
- 当用户说"每天X点""每周一三五""从今天起每晚"等重复性表述时，使用 create_recurring_time_blocks
- 参数说明：startDate 填第一天（今天或明天），endDate 或 repeatDays 填结束范围，daysOfWeek 只在特定星期几时填
- 例：每天晚上8:30-9:00学习托福，从明天起学30天 → startTime="20:30", endTime="21:00", startDate=明天日期, repeatDays=30
- 例：每周一三五下午4点跑步，跑4周 → startTime="16:00", endTime="17:00", daysOfWeek=[1,3,5], repeatDays=28

### 其他准则
- 使用中文回复用户
- 当用户描述多个事项时，对每一个都先搜索匹配
- 合理推断优先级（如用户说"紧急"→URGENT，"重要"→HIGH）
- 操作完成后简要确认即可，不要冗长

TZ_SECTION_ZH
`

const SYSTEM_PROMPT_EN = `You are the AI assistant for "Memory Garden", a personal knowledge management and task planning system.

You can help users:
- Create/update/delete tasks and schedule time blocks (work sessions)
- Create/update/delete knowledge notes
- Manage tags
- Add inbox entries
- View today's overview, task lists, note lists

## Data Model Overview

**Task**
- status: INBOX / TODO / DOING / DONE / ARCHIVED
- priority: LOW / MEDIUM / HIGH / URGENT
- dueAt: deadline (DDL)
- estimateMinutes: estimated duration in minutes
- A task can have multiple TimeBlocks (work sessions) representing when work will be done

**TimeBlock**
- Represents a specific work session (startAt → endAt)
- A task can have multiple time blocks spread across different days
- This is the core of the scheduling drag-and-drop in the planning view

**Note**
- type: ADVICE / DECISION / PERSON / LESSON / HEALTH / FINANCE / OTHER
- importance: LOW / MEDIUM / HIGH
- Notes have a spaced-repetition review system

**Tag**: Can be associated with tasks or notes

## Rules of Conduct (CRITICAL — must be strictly followed)

### ⚠️ Never create duplicate tasks (highest priority rule)

**Core concept**: In this system, a "task" represents one thing to be done. If the user says "work on physics IA tonight", they mean scheduling time to work on the existing "Physics IA" task — NOT creating a new task called "work on physics IA tonight". The correct action is to add a TimeBlock to the existing task.

**Mandatory process — must execute every time the user mentions any item**:
1. **Always call list_tasks first**. Before any other operation, check all existing tasks.
2. **Very broad fuzzy matching** — any keyword overlap or semantic relation counts as a match:
   - "study TOEFL" / "TOEFL practice" / "prepare for TOEFL" → all match existing "TOEFL"
   - "write physics IA" / "do physics IA" / "physics IA homework" → all match existing "Physics IA"
   - "review math" / "do math problems" / "math homework" → all match existing "Math" or "Math Homework"
   - **Rule**: if any noun/keyword in what the user says appears in an existing task title, it's a match.
3. **Match found → do NOT create a new task**. Operate on the existing task directly:
   - User wants to schedule time → create_time_block or create_recurring_time_blocks (using the existing task's id)
   - User wants to change deadline → update_task
   - User wants to mark complete → update_task status=DONE
4. **Only create a new task when you have confirmed no similar task exists at all.**

**Violating this rule (creating a duplicate task when one already exists) is the most critical error.**

### Recurring / repeating schedules
- When the user says "every day at X", "every Mon/Wed/Fri", "every evening starting today", use create_recurring_time_blocks
- Example: study TOEFL every evening 8:30-9pm for 30 days starting tomorrow → startTime="20:30", endTime="21:00", startDate=tomorrow's date, repeatDays=30
- Example: run Mon/Wed/Fri at 4pm for 4 weeks → startTime="16:00", endTime="17:00", daysOfWeek=[1,3,5], repeatDays=28

### Other guidelines
- Always respond in English
- When the user describes multiple items, search for matches for each one first
- Infer priority reasonably (e.g. "urgent" → URGENT, "important" → HIGH)
- After completing an action, give a brief confirmation — don't be verbose

TZ_SECTION_EN
`

/* ── API handler ── */

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const { messages, locale, timezone } = await req.json()
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "无效请求" }, { status: 400 })
  }

  const tz = (typeof timezone === "string" && timezone) ? timezone : "Asia/Shanghai"
  const lang: "zh" | "en" = locale === "en" ? "en" : "zh"

  try {
    const tzSection = buildTzSection(tz, lang)
    const basePrompt = lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH
    const systemPrompt = lang === "en"
      ? basePrompt.replace("TZ_SECTION_EN", tzSection)
      : basePrompt.replace("TZ_SECTION_ZH", tzSection)
    const fullMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ]
    // Loop to handle tool calls
    let maxIterations = 10
    while (maxIterations-- > 0) {
      const response = await chatCompletion(fullMessages, tools)

      const choice = response.choices?.[0]
      if (!choice?.message) {
        console.error("AI API unexpected response:", JSON.stringify(response))
        return NextResponse.json({
          role: "assistant",
          content: "AI 返回了意外的响应格式，请重试。",
        })
      }
      const msg = choice.message

      // If no tool calls, we're done — return the text
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return NextResponse.json({
          role: "assistant",
          content: msg.content || "",
        })
      }

      // Process tool calls
      fullMessages.push(msg)
      for (const tc of msg.tool_calls) {
        const fn = (tc as any).function
        const args = JSON.parse(fn.arguments || "{}")
        const result = await executeTool(fn.name, args, tz)
        fullMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        })
      }
      // Continue the loop so GPT can produce a final text response
    }

    return NextResponse.json({ role: "assistant", content: "抱歉，处理超时了，请重试。" })
  } catch (err: any) {
    console.error("AI API error:", err)
    return NextResponse.json({
      role: "assistant",
      content: `AI 服务出错: ${err.message || String(err)}`,
    })
  }
}
