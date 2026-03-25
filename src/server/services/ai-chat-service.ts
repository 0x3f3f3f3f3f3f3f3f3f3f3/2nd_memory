import { prisma } from "@/lib/prisma"
import {
  createInboxItem,
  deleteInboxItem,
  listInboxItems,
  processInboxItem,
} from "@/server/services/inbox-service"
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "@/server/services/notes-service"
import {
  createTag,
  updateTag,
  deleteTag,
} from "@/server/services/tags-service"
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  listTasks,
  listTimeline,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  createSubTask,
  updateSubTask,
  deleteSubTask,
} from "@/server/services/tasks-service"
import { searchEverything } from "@/server/services/search-service"
import { normalizeTimeZone, timeZoneOffsetString, zonedDayRange } from "@/server/time"
import { addDays } from "date-fns"
import { TZDate } from "@date-fns/tz"

const API_KEY = process.env.OPENAI_API_KEY!
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const actionTools = [
  // --- Query tools ---
  {
    type: "function",
    function: {
      name: "search",
      description: "Search across tasks, notes, and tags by keyword. Use when the item you need isn't in the context above, or when the user asks to find something.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task",
      description: "Get full details of a task including all subtasks and time blocks. Use before scheduling if you need to check existing time blocks.",
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
      name: "list_time_blocks",
      description: "List time blocks in a date range. Use to check the user's schedule on a specific day/week before scheduling.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "ISO 8601 start datetime" },
          end: { type: "string", description: "ISO 8601 end datetime" },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_inbox",
      description: "List all unprocessed inbox items.",
      parameters: { type: "object", properties: {} },
    },
  },

  // --- Task tools ---
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task. Only set dueAt if the user gave an explicit deadline. Do NOT set dueAt just because a scheduling time was mentioned.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["TODO", "DOING", "DONE"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: "string", description: "Deadline (ISO 8601 with tz offset). Only if user explicitly stated a deadline." },
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
      description: "Update an existing task's fields.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueAt: { type: ["string", "null"], description: "Set deadline or null to clear it." },
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
      description: "Delete a task and all its subtasks and time blocks.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },

  // --- Scheduling / time block tools ---
  {
    type: "function",
    function: {
      name: "create_time_block",
      description: "Schedule a time slot for a task. This does NOT set a deadline — it means 'plan to work on this task during this time period'.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startAt: { type: "string", description: "ISO 8601 with tz offset" },
          endAt: { type: "string", description: "ISO 8601 with tz offset" },
        },
        required: ["taskId", "startAt", "endAt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_time_block",
      description: "Reschedule an existing time block.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          startAt: { type: "string" },
          endAt: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_time_block",
      description: "Delete one time block.",
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
      name: "create_recurring_time_blocks",
      description: "Create repeated time blocks for a task across multiple days.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          startTime: { type: "string", description: "HH:MM" },
          endTime: { type: "string", description: "HH:MM" },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD" },
          repeatDays: { type: "number", description: "Repeat for N days from startDate (default 7, max 90)" },
          daysOfWeek: { type: "array", items: { type: "number" }, description: "0=Sun..6=Sat. If omitted, every day." },
        },
        required: ["taskId", "startTime", "endTime", "startDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_time_blocks_for_task",
      description: "Delete all time blocks for a given task.",
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
      description: "Delete future time blocks, optionally scoped to one task.",
      parameters: {
        type: "object",
        properties: {
          afterDate: { type: "string", description: "ISO 8601. Defaults to now." },
          taskId: { type: "string", description: "If omitted, deletes across all tasks." },
        },
      },
    },
  },

  // --- Subtask tools ---
  {
    type: "function",
    function: {
      name: "create_subtask",
      description: "Add a subtask/checklist item to a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          title: { type: "string" },
        },
        required: ["taskId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_subtask",
      description: "Update a subtask (title, done status, sort order).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          done: { type: "boolean" },
          sortOrder: { type: "number" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_subtask",
      description: "Delete a subtask.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },

  // --- Note tools ---
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a note. Notes are for thoughts, insights, lessons, advice — NOT for things that need to be done (use tasks for that).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          contentMd: { type: "string", description: "Markdown body" },
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
      description: "Update an existing note.",
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
      description: "Delete a note.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },

  // --- Tag tools ---
  {
    type: "function",
    function: {
      name: "create_tag",
      description: "Create a new tag.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string", description: "Hex color, default #6366f1" },
          description: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tag",
      description: "Update an existing tag.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Tag ID or slug" },
          name: { type: "string" },
          color: { type: "string" },
          description: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_tag",
      description: "Delete a tag.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Tag ID or slug" } },
        required: ["id"],
      },
    },
  },

  // --- Inbox tools ---
  {
    type: "function",
    function: {
      name: "add_to_inbox",
      description: "Quick-capture something to inbox for later processing.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_inbox",
      description: "Convert an inbox item into a task, note, or both.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Inbox item ID" },
          processType: { type: "string", enum: ["TASK", "NOTE", "BOTH"] },
          title: { type: "string", description: "Override title (defaults to inbox content)" },
        },
        required: ["id", "processType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_inbox",
      description: "Delete an inbox item without processing it.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: {
    userId: string
    timeZone: string
    onMutation?: () => void
  },
) {
  switch (name) {
    // --- Query ---
    case "search": {
      const result = await searchEverything(ctx.userId, String(args.query ?? ""))
      return JSON.stringify({
        tasks: result.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt?.toISOString() ?? null,
          tags: t.taskTags.map(({ tag }) => tag.name),
          subtasks: t.subTasks.length,
          timeBlocks: t.timeBlocks.length,
        })),
        notes: result.notes.map((n) => ({
          id: n.id,
          title: n.title,
          type: n.type,
          summary: n.summary,
        })),
        tags: result.tags.map((t) => ({
          id: t.id,
          name: t.name,
        })),
      })
    }
    case "get_task": {
      const task = await getTask(ctx.userId, String(args.id))
      return JSON.stringify({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString() ?? null,
        estimateMinutes: task.estimateMinutes,
        tags: task.taskTags.map(({ tag }) => ({ id: tag.id, name: tag.name })),
        subtasks: task.subTasks.map((s) => ({
          id: s.id,
          title: s.title,
          done: s.done,
        })),
        timeBlocks: task.timeBlocks.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
        })),
      })
    }
    case "list_time_blocks": {
      const blocks = await listTimeline(
        ctx.userId,
        String(args.start),
        String(args.end),
      )
      return JSON.stringify(
        blocks.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          taskId: b.task.id,
          taskTitle: b.task.title,
        })),
      )
    }
    case "list_inbox": {
      const items = await listInboxItems(ctx.userId)
      return JSON.stringify(
        items.map((i) => ({
          id: i.id,
          content: i.content,
          capturedAt: i.capturedAt.toISOString(),
        })),
      )
    }

    // --- Tasks ---
    case "create_task": {
      const task = await createTask(ctx.userId, {
        title: String(args.title),
        description: typeof args.description === "string" ? args.description : null,
        status: (args.status as "TODO" | "DOING" | "DONE" | undefined) ?? "TODO",
        priority: (args.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined) ?? "MEDIUM",
        dueAt: typeof args.dueAt === "string" ? args.dueAt : null,
        estimateMinutes: typeof args.estimateMinutes === "number" ? args.estimateMinutes : null,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : [],
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: task.id, title: task.title })
    }
    case "update_task": {
      const task = await updateTask(ctx.userId, String(args.id), {
        title: typeof args.title === "string" ? args.title : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        status: typeof args.status === "string" ? (args.status as never) : undefined,
        priority: typeof args.priority === "string" ? (args.priority as never) : undefined,
        dueAt: "dueAt" in args
          ? args.dueAt === null ? null : typeof args.dueAt === "string" ? args.dueAt : undefined
          : undefined,
        estimateMinutes: typeof args.estimateMinutes === "number" ? args.estimateMinutes : undefined,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : undefined,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: task.id, title: task.title, status: task.status })
    }
    case "delete_task": {
      await deleteTask(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }

    // --- Time blocks ---
    case "create_time_block": {
      const block = await createTimeBlock(ctx.userId, String(args.taskId), {
        startAt: String(args.startAt),
        endAt: String(args.endAt),
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: block.id })
    }
    case "update_time_block": {
      const block = await updateTimeBlock(ctx.userId, String(args.id), {
        startAt: typeof args.startAt === "string" ? args.startAt : undefined,
        endAt: typeof args.endAt === "string" ? args.endAt : undefined,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: block.id })
    }
    case "delete_time_block": {
      await deleteTimeBlock(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }
    case "create_recurring_time_blocks": {
      const taskId = String(args.taskId)
      const startTime = String(args.startTime)
      const endTime = String(args.endTime)
      const startDate = String(args.startDate)
      const endDate = typeof args.endDate === "string" ? args.endDate : null
      const repeatDays = typeof args.repeatDays === "number" ? Math.min(args.repeatDays, 90) : 7
      const daysOfWeek = Array.isArray(args.daysOfWeek) ? (args.daysOfWeek as number[]) : null
      const offset = timeZoneOffsetString(ctx.timeZone)

      const firstDay = new Date(`${startDate}T00:00:00${offset}`)
      const lastDay = endDate ? new Date(`${endDate}T00:00:00${offset}`) : new Date(firstDay.getTime() + (repeatDays - 1) * 86400000)

      let cursor = new Date(firstDay)
      let created = 0
      while (cursor <= lastDay) {
        const utcDay = cursor.getUTCDay()
        if (!daysOfWeek || daysOfWeek.includes(utcDay)) {
          const dateString = cursor.toISOString().slice(0, 10)
          await createTimeBlock(ctx.userId, taskId, {
            startAt: `${dateString}T${startTime}:00${offset}`,
            endAt: `${dateString}T${endTime}:00${offset}`,
          })
          created += 1
        }
        cursor = new Date(cursor.getTime() + 86400000)
      }
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, created })
    }
    case "delete_all_time_blocks_for_task": {
      const result = await prisma.timeBlock.deleteMany({
        where: {
          taskId: String(args.taskId),
          task: { userId: ctx.userId },
        },
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, deleted: result.count })
    }
    case "delete_future_time_blocks": {
      const after = typeof args.afterDate === "string" ? new Date(args.afterDate) : new Date()
      const result = await prisma.timeBlock.deleteMany({
        where: {
          startAt: { gte: after },
          ...(typeof args.taskId === "string"
            ? { taskId: args.taskId, task: { userId: ctx.userId } }
            : { task: { userId: ctx.userId } }),
        },
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, deleted: result.count })
    }

    // --- Subtasks ---
    case "create_subtask": {
      const sub = await createSubTask(ctx.userId, String(args.taskId), String(args.title))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: sub.id, title: sub.title })
    }
    case "update_subtask": {
      const sub = await updateSubTask(ctx.userId, String(args.id), {
        title: typeof args.title === "string" ? args.title : undefined,
        done: typeof args.done === "boolean" ? args.done : undefined,
        sortOrder: typeof args.sortOrder === "number" ? args.sortOrder : undefined,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: sub.id, done: sub.done })
    }
    case "delete_subtask": {
      await deleteSubTask(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }

    // --- Notes ---
    case "create_note": {
      const note = await createNote(ctx.userId, {
        title: String(args.title),
        summary: typeof args.summary === "string" ? args.summary : "",
        contentMd: typeof args.contentMd === "string" ? args.contentMd : "",
        type: (typeof args.type === "string" ? args.type : "OTHER") as never,
        importance: (typeof args.importance === "string" ? args.importance : "MEDIUM") as never,
        isPinned: false,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : [],
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: note.id, title: note.title })
    }
    case "update_note": {
      await updateNote(ctx.userId, String(args.id), {
        title: typeof args.title === "string" ? args.title : undefined,
        summary: typeof args.summary === "string" ? args.summary : undefined,
        contentMd: typeof args.contentMd === "string" ? args.contentMd : undefined,
        type: typeof args.type === "string" ? (args.type as never) : undefined,
        importance: typeof args.importance === "string" ? (args.importance as never) : undefined,
        tagIds: Array.isArray(args.tagIds) ? (args.tagIds as string[]) : undefined,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }
    case "delete_note": {
      await deleteNote(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }

    // --- Tags ---
    case "create_tag": {
      const tag = await createTag(ctx.userId, {
        name: String(args.name),
        color: typeof args.color === "string" ? args.color : "#6366f1",
        description: typeof args.description === "string" ? args.description : null,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: tag.id, name: tag.name })
    }
    case "update_tag": {
      const tag = await updateTag(ctx.userId, String(args.id), {
        name: typeof args.name === "string" ? args.name : undefined,
        color: typeof args.color === "string" ? args.color : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
      })
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: tag.id, name: tag.name })
    }
    case "delete_tag": {
      await deleteTag(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }

    // --- Inbox ---
    case "add_to_inbox": {
      const item = await createInboxItem(ctx.userId, String(args.content))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true, id: item.id })
    }
    case "process_inbox": {
      const result = await processInboxItem(
        ctx.userId,
        String(args.id),
        args.processType as "TASK" | "NOTE" | "BOTH",
        typeof args.title === "string" ? args.title : undefined,
      )
      ctx.onMutation?.()
      return JSON.stringify({
        ok: true,
        taskId: result.task?.id ?? null,
        noteId: result.note?.id ?? null,
      })
    }
    case "delete_inbox": {
      await deleteInboxItem(ctx.userId, String(args.id))
      ctx.onMutation?.()
      return JSON.stringify({ ok: true })
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

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
    subTasks: Array<{ id: string; title: string; done: boolean }>
    timeBlocks: Array<{ id: string; startAt: Date; endAt: Date }>
  }>,
  tags: Array<{ id: string; name: string; color: string }>,
  upcomingBlocks: Array<{
    id: string
    startAt: Date
    endAt: Date
    task: { id: string; title: string }
  }>,
) {
  const offset = timeZoneOffsetString(timeZone)
  const now = new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())

  const taskLines = tasks.map((t) => {
    const parts = [`${t.id}: ${t.title} [${t.status}/${t.priority}]`]
    if (t.dueAt) {
      parts.push(`ddl:${new Date(t.dueAt).toLocaleDateString("en-CA", { timeZone })}`)
    }
    if (t.estimateMinutes) {
      parts.push(`est:${t.estimateMinutes}min`)
    }
    if (t.taskTags.length) {
      parts.push(`#${t.taskTags.map(({ tag }) => tag.name).join(" #")}`)
    }
    if (t.subTasks.length) {
      const done = t.subTasks.filter((s) => s.done).length
      parts.push(`sub:${done}/${t.subTasks.length}`)
    }
    if (t.timeBlocks.length) {
      parts.push(`blocks:${t.timeBlocks.length}`)
    }
    return `- ${parts.join(" | ")}`
  }).join("\n")

  const blockLines = upcomingBlocks.map((b) => {
    const day = new Date(b.startAt).toLocaleDateString("en-CA", { timeZone })
    const start = new Date(b.startAt).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
    const end = new Date(b.endAt).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
    return `- [${b.id}] ${day} ${start}-${end} ${b.task.title}`
  }).join("\n")

  const tagLine = tags.map((t) => `${t.name}(${t.id})`).join(", ")

  if (language === "zh-Hans") {
    return `你是 Sage，个人任务和知识管理助手。快速准确地理解用户意图，直接执行。

## 数据模型

- 任务(Task)：需要做的事。有 status(TODO/DOING/DONE)、priority、dueAt(截止日期)、estimateMinutes
- 时间块(TimeBlock)：绑定到任务，表示"计划在某段时间做某个任务"，有 startAt/endAt
- 子任务(SubTask)：任务的检查清单项
- 笔记(Note)：想法、感悟、学到的东西、建议、经验。不是"要做的事"
- 标签(Tag)：可以给任务和笔记打标签
- 收件箱(Inbox)：快速捕获，之后可转为任务或笔记

## 判断规则

1. 内容分类：
   - "要做/需要/得/帮我/安排/计划/提醒/记得" + 具体事情 → 任务
   - 分享想法/感悟/学到的/经验/建议 → 笔记
   - 不确定 → 默认任务

2. 截止日期(dueAt) vs 排期(TimeBlock) — 非常重要：
   - 排期 = 计划什么时候做 → 只调用 create_time_block（"明天中午12点写IA，30分钟"→ timeBlock 12:00-12:30）
   - 截止日期 = 最晚什么时候完成 → 只修改 dueAt（"周五前交IA"→ dueAt=周五 23:59）
   - 关键词："前/之前/before/by/due/deadline/截止/交/提交/完成" → 截止日期
   - 其他时间表达（"明天做/写/开始"、"下午3点"、"安排到周六上午"）→ 排期
   - 排期时绝对不能修改任务本身的任何属性（dueAt/status/priority等），只添加 time block
   - 任务通常是一个大目标，排期只是规划某个时间段去做它的一部分

3. 查找已有任务：
   - 排期或更新操作前，先在下面的任务列表中模糊匹配标题
   - 找不到 → 调用 search 工具
   - 确实不存在 → 先 create_task（不设 dueAt），再 create_time_block
   - 找到了已有任务 → 直接对该任务 create_time_block，不要 update_task

4. 执行规则：
   - 用户要求操作时，必须调用工具。不能只口头回复"已完成"
   - 可以并行调用多个工具
   - 时间格式：ISO 8601 + 时区偏移，如 2026-03-26T12:00:00${offset}

5. 回复风格：简洁直接，用一两句话确认完成了什么。不需要复述用户说的话。

## 当前上下文

时间：${now}
时区：${timeZone} (UTC${offset})

近3日时间块：
${blockLines || "（无）"}

任务列表：
${taskLines || "（无）"}

标签：${tagLine || "（无）"}`
  }

  return `You are Sage, a personal task and knowledge management assistant. Understand user intent quickly and act directly.

## Data Model

- Task: something that needs to be done. Has status (TODO/DOING/DONE), priority, dueAt (deadline), estimateMinutes
- TimeBlock: attached to a task, means "plan to work on this task during this time period", has startAt/endAt
- SubTask: checklist items within a task
- Note: thoughts, insights, lessons, advice, experiences. NOT for things that need to be done
- Tag: labels for tasks and notes
- Inbox: quick capture, can later be converted to task or note

## Decision Rules

1. Classification:
   - "need to / should / must / plan / schedule / remind me" + action → Task
   - Sharing thoughts / insights / lessons / advice → Note
   - Uncertain → default to Task

2. Deadline (dueAt) vs Scheduling (TimeBlock) — critical distinction:
   - Scheduling = when to work on it → ONLY call create_time_block ("write IA tomorrow at noon, 30 min" → timeBlock 12:00-12:30)
   - Deadline = latest completion time → ONLY modify dueAt ("IA due Friday" → dueAt=Friday 23:59)
   - Keywords: "before / by / due / deadline / submit" → deadline
   - Other time expressions ("do tomorrow / start at 3pm / schedule for Saturday") → scheduling
   - When scheduling, NEVER modify the task itself (dueAt/status/priority etc.), only add a time block
   - A task is usually a big goal; scheduling just plans when to work on a portion of it

3. Finding existing tasks:
   - Before scheduling or updating, first fuzzy-match the title in the task list below
   - Not found → use the search tool
   - Truly doesn't exist → create_task first (no dueAt), then create_time_block
   - Found existing task → directly create_time_block for it, do NOT call update_task

4. Execution rules:
   - When the user requests an action, you MUST call tools. Never just say "done" without actually doing it.
   - You can call multiple tools in parallel.
   - Time format: ISO 8601 with tz offset, e.g. 2026-03-26T12:00:00${offset}

5. Response style: concise and direct. Confirm what was done in 1-2 sentences. Don't repeat back what the user said.

## Current Context

Time: ${now}
Timezone: ${timeZone} (UTC${offset})

Upcoming 3-day schedule:
${blockLines || "(none)"}

Tasks:
${taskLines || "(none)"}

Tags: ${tagLine || "(none)"}`
}

// ---------------------------------------------------------------------------
// GPT streaming with tool-call loop
// ---------------------------------------------------------------------------

interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

async function callGPTStreaming(
  messages: unknown[],
  onTextChunk: (text: string) => void,
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function streamAiChat(input: {
  userId: string
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: AiChatMessage[]
  onMutation?: () => void
}) {
  const effectiveTimeZone = normalizeTimeZone(input.timeZone?.trim?.() ?? input.timeZone, "UTC")

  // Load 3 days of time blocks for context
  const { start: todayStart } = zonedDayRange(effectiveTimeZone)
  const threeDaysEnd = addDays(todayStart, 3)

  const [tasks, tags, upcomingBlocks] = await Promise.all([
    prisma.task.findMany({
      where: { userId: input.userId, status: { not: "ARCHIVED" } },
      include: {
        taskTags: { include: { tag: { select: { id: true, name: true } } } },
        subTasks: { orderBy: { sortOrder: "asc" } },
        timeBlocks: { orderBy: { startAt: "asc" } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.tag.findMany({
      where: { userId: input.userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.timeBlock.findMany({
      where: {
        task: { userId: input.userId },
        startAt: { gte: todayStart, lt: threeDaysEnd },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startAt: "asc" },
    }),
  ])

  const fullMessages: unknown[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.locale, effectiveTimeZone, tasks, tags, upcomingBlocks),
    },
    ...input.messages,
  ]

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        let steps = 8
        while (steps-- > 0) {
          const toolCalls = await callGPTStreaming(
            fullMessages,
            (text) => {
              controller.enqueue(encoder.encode(text))
            },
          )

          if (!toolCalls) {
            controller.close()
            return
          }

          fullMessages.push({
            role: "assistant",
            content: null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: tc.function,
            })),
          })

          const results = await Promise.all(
            toolCalls.map(async (tc) => {
              const args = JSON.parse(tc.function.arguments || "{}")
              const result = await executeTool(tc.function.name, args, {
                userId: input.userId,
                timeZone: effectiveTimeZone,
                onMutation: input.onMutation,
              })
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content: result,
              }
            }),
          )

          fullMessages.push(...results)
        }

        controller.enqueue(
          encoder.encode(input.locale === "en" ? "Too many steps. Please simplify." : "步骤过多，请简化请求。"),
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
