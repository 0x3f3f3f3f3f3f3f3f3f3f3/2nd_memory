import { prisma } from "@/lib/prisma"
import {
  AiAction,
  AiExecutionMutation,
  AiExecutionResult,
  AiIntentPlan,
} from "@/server/ai/contracts"
import { normalizeTitleForMatch } from "@/server/ai/normalization"
import {
  AiNoteRecord,
  AiTaskRecord,
  hasExistingTaskOccurrence,
  hasExistingTimeBlock,
  resolveNoteCandidate,
  resolveTaskCandidate,
} from "@/server/ai/retrieval"
import { createInboxItem } from "@/server/services/inbox-service"
import { createNote, updateNote, upsertNoteLink } from "@/server/services/notes-service"
import { createTag, listTags } from "@/server/services/tags-service"
import { createTask, createTimeBlock, updateTask } from "@/server/services/tasks-service"
import { taskInclude } from "@/server/services/common"

type TaskWriteResult = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueAt: Date | null
  reminderAt: Date | null
  updatedAt: Date
  subTasks: Array<{ id: string; title: string; done: boolean }>
  timeBlocks: Array<{ id: string; startAt: Date; endAt: Date; isAllDay: boolean; subTaskId?: string | null }>
}

type NoteWriteResult = {
  id: string
  title: string
  summary: string
  contentMd: string
  type: string
  importance: string
  updatedAt: Date
  noteTasks: Array<{ task: { id: string; title: string } }>
}

export type AiExecutionRepository = {
  loadState(userId: string): Promise<ExecutionState>
  createInbox(userId: string, content: string): Promise<{ id: string }>
  createTag(userId: string, input: { name: string; color: string }): Promise<{ id: string; name: string; color: string }>
  createTask(userId: string, input: Parameters<typeof createTask>[1]): Promise<TaskWriteResult>
  updateTask(userId: string, id: string, input: Parameters<typeof updateTask>[2]): Promise<TaskWriteResult>
  createTimeBlock(userId: string, taskId: string, input: Parameters<typeof createTimeBlock>[2]): Promise<{ id: string; startAt: Date; endAt: Date; isAllDay: boolean; subTaskId?: string | null }>
  createNote(userId: string, input: Parameters<typeof createNote>[1]): Promise<NoteWriteResult>
  updateNote(userId: string, id: string, input: Parameters<typeof updateNote>[2]): Promise<NoteWriteResult>
  upsertNoteLink(userId: string, input: Parameters<typeof upsertNoteLink>[1]): Promise<Awaited<ReturnType<typeof upsertNoteLink>>>
}

type ExecutionState = {
  tasks: AiTaskRecord[]
  notes: AiNoteRecord[]
  tags: Array<{ id: string; name: string; color: string }>
  createdTaskIdsByNormalizedTitle: Map<string, string>
  createdNoteIdsByNormalizedTitle: Map<string, string>
}

export const productionAiExecutionRepository: AiExecutionRepository = {
  async loadState(userId: string) {
    const [tasks, notes, tags] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { not: "ARCHIVED" } },
        include: taskInclude,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.note.findMany({
        where: { userId, archivedAt: null },
        include: {
          noteTasks: { include: { task: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      listTags(userId),
    ])

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        reminderAt: task.reminderAt,
        updatedAt: task.updatedAt,
        subTasks: task.subTasks.map((subTask) => ({ id: subTask.id, title: subTask.title, done: subTask.done })),
        timeBlocks: task.timeBlocks.map((block) => ({
          id: block.id,
          startAt: block.startAt,
          endAt: block.endAt,
          isAllDay: block.isAllDay,
          subTaskId: block.subTaskId ?? null,
        })),
      })),
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        summary: note.summary,
        contentMd: note.contentMd,
        type: note.type,
        importance: note.importance,
        updatedAt: note.updatedAt,
        noteTasks: note.noteTasks.map((entry) => ({ task: { id: entry.task.id, title: entry.task.title } })),
      })),
      tags: tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
      createdTaskIdsByNormalizedTitle: new Map(),
      createdNoteIdsByNormalizedTitle: new Map(),
    }
  },
  createInbox: createInboxItem,
  createTag: (userId, input) => createTag(userId, { ...input }),
  createTask,
  updateTask,
  createTimeBlock,
  createNote,
  updateNote,
  upsertNoteLink,
}

function appendUniqueContent(existing: string, next: string) {
  if (!next.trim()) return existing
  if (!existing.trim()) return next
  if (existing.includes(next.trim())) return existing
  return `${existing.trim()}\n\n## 补充\n${next.trim()}`
}

async function ensureTagIds(userId: string, state: ExecutionState, repo: AiExecutionRepository, tagNames?: string[], tagIds?: string[]) {
  const ids = new Set<string>(tagIds ?? [])
  for (const name of tagNames ?? []) {
    const normalized = normalizeTitleForMatch(name)
    const existing = state.tags.find((tag) => normalizeTitleForMatch(tag.name) === normalized)
    if (existing) {
      ids.add(existing.id)
      continue
    }
    const created = await repo.createTag(userId, {
      name,
      color: "#C96444",
    })
    state.tags.push({ id: created.id, name: created.name, color: created.color })
    ids.add(created.id)
  }
  return Array.from(ids)
}

function registerTask(state: ExecutionState, task: {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueAt: Date | null
  reminderAt: Date | null
  updatedAt: Date
  subTasks?: Array<{ id: string; title: string; done: boolean }>
  timeBlocks?: Array<{ id: string; startAt: Date; endAt: Date; isAllDay: boolean; subTaskId?: string | null }>
}) {
  const next: AiTaskRecord = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    updatedAt: task.updatedAt,
    subTasks: task.subTasks ?? [],
    timeBlocks: (task.timeBlocks ?? []).map((block) => ({
      id: block.id,
      startAt: block.startAt,
      endAt: block.endAt,
      isAllDay: block.isAllDay,
      subTaskId: block.subTaskId ?? null,
    })),
  }
  const index = state.tasks.findIndex((item) => item.id === task.id)
  if (index >= 0) state.tasks[index] = next
  else state.tasks.unshift(next)
  state.createdTaskIdsByNormalizedTitle.set(normalizeTitleForMatch(task.title), task.id)
  return next
}

function registerNote(state: ExecutionState, note: {
  id: string
  title: string
  summary: string
  contentMd: string
  type: string
  importance: string
  updatedAt: Date
  noteTasks?: Array<{ task: { id: string; title: string } }>
}) {
  const next: AiNoteRecord = {
    id: note.id,
    title: note.title,
    summary: note.summary,
    contentMd: note.contentMd,
    type: note.type,
    importance: note.importance,
    updatedAt: note.updatedAt,
    noteTasks: note.noteTasks ?? [],
  }
  const index = state.notes.findIndex((item) => item.id === note.id)
  if (index >= 0) state.notes[index] = next
  else state.notes.unshift(next)
  state.createdNoteIdsByNormalizedTitle.set(normalizeTitleForMatch(note.title), note.id)
  return next
}

function findTaskIdByTitle(state: ExecutionState, title: string) {
  const normalized = normalizeTitleForMatch(title)
  return state.createdTaskIdsByNormalizedTitle.get(normalized)
    ?? resolveTaskCandidate(state.tasks, { title, query: title })?.item.id
    ?? null
}

function findNoteIdByQuery(state: ExecutionState, query: { title?: string | null; id?: string | null; search?: string | null }) {
  if (query.id) return query.id
  if (query.title) {
    const normalized = normalizeTitleForMatch(query.title)
    const fromCreated = state.createdNoteIdsByNormalizedTitle.get(normalized)
    if (fromCreated) return fromCreated
  }
  return resolveNoteCandidate(state.notes, { title: query.title ?? null, query: query.search ?? null })?.item.id ?? null
}

async function executeUpsertTask(userId: string, action: Extract<AiAction, { type: "upsert_task" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  const match = action.matchStrategy === "always_create"
    ? null
    : resolveTaskCandidate(state.tasks, { title: action.title, query: action.targetQuery ?? action.sourceText ?? action.title })

  const existing = match?.item ?? hasExistingTaskOccurrence(state.tasks, action.title, {
    dueAt: action.dueAt ?? null,
    reminderAt: action.reminderAt ?? null,
  })

  const tagIds = await ensureTagIds(userId, state, repo, action.tagNames, action.tagIds)

  if (existing) {
    const updated = await repo.updateTask(userId, existing.id, {
      title: action.title,
      description: action.description ?? existing.description,
      status: action.status as never,
      priority: action.priority as never,
      dueAt: action.dueAt ?? undefined,
      reminderAt: action.reminderAt ?? undefined,
      estimateMinutes: action.estimateMinutes ?? undefined,
      tagIds,
    })
    registerTask(state, updated)
    mutations.push({ type: "task_updated", taskId: updated.id, title: updated.title })
    return updated.id
  }

  const created = await repo.createTask(userId, {
    title: action.title,
    description: action.description ?? null,
    status: action.status ?? "TODO",
    priority: action.priority ?? "MEDIUM",
    dueAt: action.dueAt ?? null,
    reminderAt: action.reminderAt ?? null,
    estimateMinutes: action.estimateMinutes ?? null,
    tagIds,
  })
  registerTask(state, created)
  mutations.push({ type: "task_created", taskId: created.id, title: created.title })
  return created.id
}

async function executeScheduleTask(userId: string, action: Extract<AiAction, { type: "schedule_task" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  const resolved = resolveTaskCandidate(state.tasks, {
    title: action.taskTitle,
    query: action.taskQuery ?? action.taskTitle,
  })
  const taskId = resolved?.item.id
    ?? (action.createTaskIfMissing
      ? await executeUpsertTask(userId, {
          type: "upsert_task",
          title: action.taskTitle,
          description: action.taskDescriptionIfCreate,
          status: "TODO",
          priority: "MEDIUM",
          matchStrategy: "always_create",
        }, state, mutations, repo)
      : null)

  if (!taskId) return
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task) return

  const existing = hasExistingTimeBlock(task, { startAt: action.startAt, endAt: action.endAt })
  if (existing) {
    mutations.push({ type: "time_block_reused", taskId: task.id, taskTitle: task.title, blockId: existing.id })
    return
  }

  const block = await repo.createTimeBlock(userId, taskId, {
    startAt: action.startAt,
    endAt: action.endAt,
    isAllDay: action.isAllDay ?? false,
  })
  task.timeBlocks.push({
    id: block.id,
    startAt: block.startAt,
    endAt: block.endAt,
    isAllDay: block.isAllDay,
    subTaskId: block.subTaskId ?? null,
  })
  mutations.push({ type: "time_block_created", taskId: task.id, taskTitle: task.title, blockId: block.id })
}

async function executeRecurringSchedule(userId: string, action: Extract<AiAction, { type: "create_recurring_schedule" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  const taskId = await executeUpsertTask(userId, {
    type: "upsert_task",
    title: action.taskTitle,
    description: action.taskDescriptionIfCreate,
    status: "TODO",
    priority: "MEDIUM",
    matchStrategy: action.createTaskIfMissing ? "normalized_title" : "search_query",
    targetQuery: action.taskQuery ?? action.taskTitle,
  }, state, mutations, repo)

  for (const occurrence of action.occurrences) {
    await executeScheduleTask(userId, {
      type: "schedule_task",
      taskTitle: action.taskTitle,
      taskQuery: action.taskQuery,
      createTaskIfMissing: false,
      startAt: occurrence.startAt!,
      endAt: occurrence.endAt!,
      isAllDay: occurrence.isAllDay ?? false,
    }, state, mutations, repo)
  }

  return taskId
}

async function executeBulkDiscreteTasks(userId: string, action: Extract<AiAction, { type: "bulk_create_discrete_tasks" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  for (const occurrence of action.occurrences) {
    const title = occurrence.title ?? action.title ?? action.titleTemplate ?? "Task"
    await executeUpsertTask(userId, {
      type: "upsert_task",
      title,
      description: action.description,
      status: "TODO",
      priority: "MEDIUM",
      dueAt: occurrence.dueAt ?? null,
      reminderAt: occurrence.reminderAt ?? null,
      matchStrategy: "always_create",
    }, state, mutations, repo)
  }
}

async function executeUpsertNote(userId: string, action: Extract<AiAction, { type: "upsert_note" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  const relatedTaskIds = [
    ...(action.relatedTaskIds ?? []),
    ...(action.relatedTaskTitles ?? [])
      .map((title) => findTaskIdByTitle(state, title))
      .filter((value): value is string => !!value),
  ]
  const tagIds = await ensureTagIds(userId, state, repo, action.tagNames, action.tagIds)

  const existing = action.updateStrategy === "create_new"
    ? null
    : resolveNoteCandidate(state.notes, { title: action.title, query: action.targetQuery ?? action.sourceText ?? action.title })?.item

  if (existing) {
    const updated = await repo.updateNote(userId, existing.id, {
      title: action.updateStrategy === "append" ? existing.title : action.title,
      summary: action.summary || existing.summary,
      contentMd:
        action.updateStrategy === "replace"
          ? action.contentMd
          : appendUniqueContent(existing.contentMd, action.contentMd),
      type: (action.typeHint ?? existing.type) as never,
      importance: (action.importance ?? existing.importance) as never,
      tagIds,
      relatedTaskIds,
      metadata: {
        ai: {
          enriched: true,
          sourceText: action.sourceText ?? null,
        },
      },
    })
    registerNote(state, updated)
    mutations.push({ type: "note_updated", noteId: updated.id, title: updated.title })
    return updated.id
  }

  const created = await repo.createNote(userId, {
    title: action.title,
    summary: action.summary,
    contentMd: action.contentMd,
    type: (action.typeHint ?? "OTHER") as never,
    importance: (action.importance ?? "MEDIUM") as never,
    isPinned: false,
    tagIds,
    relatedTaskIds,
    metadata: {
      ai: {
        enriched: true,
        sourceText: action.sourceText ?? null,
      },
    },
  })
  registerNote(state, created)
  mutations.push({ type: "note_created", noteId: created.id, title: created.title })
  return created.id
}

async function executeLinkNoteToNote(userId: string, action: Extract<AiAction, { type: "link_note_to_note" }>, state: ExecutionState, mutations: AiExecutionMutation[], repo: AiExecutionRepository) {
  const fromNoteId = findNoteIdByQuery(state, {
    id: action.fromId ?? null,
    title: action.fromTitle ?? null,
    search: action.fromQuery ?? null,
  })
  const toNoteId = findNoteIdByQuery(state, {
    id: action.toId ?? null,
    title: action.toTitle ?? null,
    search: action.toQuery ?? null,
  })

  if (!fromNoteId || !toNoteId) return

  await repo.upsertNoteLink(userId, {
    fromNoteId,
    toNoteId,
    relationType: action.relationType,
  })
  mutations.push({ type: "note_linked", fromNoteId, toNoteId, relationType: action.relationType })
}

function buildExecutionSummary(locale: "zh-Hans" | "en", mutations: AiExecutionMutation[]) {
  if (mutations.length === 0) {
    return locale === "en" ? "I understood the request, but there was nothing to change." : "我理解了你的意图，但没有需要实际变更的数据。"
  }

  const counts = mutations.reduce<Record<string, number>>((acc, mutation) => {
    acc[mutation.type] = (acc[mutation.type] ?? 0) + 1
    return acc
  }, {})

  if (locale === "en") {
    return `Done: ${Object.entries(counts).map(([type, count]) => `${type} x${count}`).join(", ")}.`
  }
  return `已执行：${Object.entries(counts).map(([type, count]) => `${type} ×${count}`).join("，")}。`
}

export async function executeAiIntentPlan(input: {
  userId: string
  locale: "zh-Hans" | "en"
  plan: AiIntentPlan
  onMutation?: () => void
  repository?: AiExecutionRepository
}): Promise<AiExecutionResult> {
  const repository = input.repository ?? productionAiExecutionRepository
  const state = await repository.loadState(input.userId)
  const mutations: AiExecutionMutation[] = []

  if (input.plan.mode !== "execute") {
    return {
      plan: input.plan,
      mutations,
      userFacingSummary: input.plan.userFacingSummary,
    }
  }

  for (const action of input.plan.actions) {
    switch (action.type) {
      case "upsert_task":
        await executeUpsertTask(input.userId, action, state, mutations, repository)
        break
      case "schedule_task":
        await executeScheduleTask(input.userId, action, state, mutations, repository)
        break
      case "create_recurring_schedule":
        await executeRecurringSchedule(input.userId, action, state, mutations, repository)
        break
      case "bulk_create_discrete_tasks":
        await executeBulkDiscreteTasks(input.userId, action, state, mutations, repository)
        break
      case "upsert_note":
        await executeUpsertNote(input.userId, action, state, mutations, repository)
        break
      case "link_note_to_note":
        await executeLinkNoteToNote(input.userId, action, state, mutations, repository)
        break
      case "capture_to_inbox": {
        const inbox = await repository.createInbox(input.userId, action.content)
        mutations.push({ type: "inbox_captured", inboxId: inbox.id })
        break
      }
      default: {
        const exhaustiveCheck: never = action
        throw new Error(`Unhandled AI action: ${JSON.stringify(exhaustiveCheck)}`)
      }
    }
  }

  if (mutations.length > 0) {
    input.onMutation?.()
  }

  return {
    plan: input.plan,
    mutations,
    userFacingSummary: buildExecutionSummary(input.locale, mutations),
  }
}
