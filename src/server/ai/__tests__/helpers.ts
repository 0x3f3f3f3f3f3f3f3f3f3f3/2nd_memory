import type { AiExecutionRepository } from "@/server/ai/executor"
import type { RelationType } from "@prisma/client"

type SeedTask = {
  id?: string
  title: string
  description?: string | null
  status?: string
  priority?: string
  dueAt?: string | null
  reminderAt?: string | null
  updatedAt?: string
  subTasks?: Array<{ id?: string; title: string; done?: boolean }>
  timeBlocks?: Array<{ id?: string; startAt: string; endAt: string; isAllDay?: boolean; subTaskId?: string | null }>
}

type SeedNote = {
  id?: string
  title: string
  summary?: string
  contentMd?: string
  type?: string
  importance?: string
  updatedAt?: string
  noteTasks?: Array<{ task: { id: string; title: string } }>
}

type SeedState = {
  tasks?: SeedTask[]
  notes?: SeedNote[]
  tags?: Array<{ id?: string; name: string; color?: string }>
  inbox?: Array<{ id?: string; content: string }>
  noteLinks?: Array<{ fromNoteId: string; toNoteId: string; relationType: RelationType }>
}

function nextId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function createInMemoryRepository(seed: SeedState = {}) {
  const tasks = (seed.tasks ?? []).map((task) => ({
    id: task.id ?? nextId("task"),
    title: task.title,
    description: task.description ?? null,
    status: task.status ?? "TODO",
    priority: task.priority ?? "MEDIUM",
    dueAt: task.dueAt ? new Date(task.dueAt) : null,
    reminderAt: task.reminderAt ? new Date(task.reminderAt) : null,
    updatedAt: new Date(task.updatedAt ?? "2026-03-30T00:00:00.000Z"),
    subTasks: (task.subTasks ?? []).map((subTask) => ({
      id: subTask.id ?? nextId("subtask"),
      title: subTask.title,
      done: subTask.done ?? false,
    })),
    timeBlocks: (task.timeBlocks ?? []).map((block) => ({
      id: block.id ?? nextId("block"),
      startAt: new Date(block.startAt),
      endAt: new Date(block.endAt),
      isAllDay: block.isAllDay ?? false,
      subTaskId: block.subTaskId ?? null,
    })),
  }))

  const notes = (seed.notes ?? []).map((note) => ({
    id: note.id ?? nextId("note"),
    title: note.title,
    summary: note.summary ?? "",
    contentMd: note.contentMd ?? "",
    type: note.type ?? "OTHER",
    importance: note.importance ?? "MEDIUM",
    updatedAt: new Date(note.updatedAt ?? "2026-03-30T00:00:00.000Z"),
    noteTasks: note.noteTasks ?? [],
  }))

  const tags = (seed.tags ?? []).map((tag) => ({
    id: tag.id ?? nextId("tag"),
    name: tag.name,
    color: tag.color ?? "#C96444",
  }))

  const inbox = (seed.inbox ?? []).map((item) => ({
    id: item.id ?? nextId("inbox"),
    content: item.content,
  }))

  const noteLinks: Array<{ id?: string; fromNoteId: string; toNoteId: string; relationType: RelationType }> = [...(seed.noteLinks ?? [])]

  const repository: AiExecutionRepository = {
    async loadState() {
      return {
        tasks: tasks.map((task) => ({
          ...task,
          subTasks: [...task.subTasks],
          timeBlocks: [...task.timeBlocks],
        })),
        notes: notes.map((note) => ({
          ...note,
          noteTasks: [...note.noteTasks],
        })),
        tags: [...tags],
        createdTaskIdsByNormalizedTitle: new Map(),
        createdNoteIdsByNormalizedTitle: new Map(),
      }
    },
    async createInbox(_userId, content) {
      const item = { id: nextId("inbox"), content }
      inbox.push(item)
      return item
    },
    async createTag(_userId, input) {
      const tag = { id: nextId("tag"), name: input.name, color: input.color }
      tags.push(tag)
      return tag
    },
    async createTask(_userId, input) {
      const task = {
        id: nextId("task"),
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
        updatedAt: new Date(),
        subTasks: [],
        timeBlocks: [],
      }
      tasks.unshift(task)
      return task
    },
    async updateTask(_userId, id, input) {
      const task = tasks.find((item) => item.id === id)
      if (!task) throw new Error(`Task not found: ${id}`)
      Object.assign(task, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(input.reminderAt !== undefined ? { reminderAt: input.reminderAt ? new Date(input.reminderAt) : null } : {}),
        updatedAt: new Date(),
      })
      return task
    },
    async createTimeBlock(_userId, taskId, input) {
      const task = tasks.find((item) => item.id === taskId)
      if (!task) throw new Error(`Task not found: ${taskId}`)
      const block = {
        id: nextId("block"),
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        isAllDay: input.isAllDay ?? false,
        subTaskId: input.subTaskId ?? null,
      }
      task.timeBlocks.push(block)
      task.updatedAt = new Date()
      return block
    },
    async createNote(_userId, input) {
      const note = {
        id: nextId("note"),
        title: input.title,
        summary: input.summary,
        contentMd: input.contentMd,
        type: input.type,
        importance: input.importance,
        updatedAt: new Date(),
        noteTasks: (input.relatedTaskIds ?? [])
          .map((taskId) => tasks.find((task) => task.id === taskId))
          .filter((task): task is NonNullable<typeof task> => !!task)
          .map((task) => ({ task: { id: task.id, title: task.title } })),
      }
      notes.unshift(note)
      return note
    },
    async updateNote(_userId, id, input) {
      const note = notes.find((item) => item.id === id)
      if (!note) throw new Error(`Note not found: ${id}`)
      Object.assign(note, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.contentMd !== undefined ? { contentMd: input.contentMd } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.importance !== undefined ? { importance: input.importance } : {}),
        ...(input.relatedTaskIds !== undefined
          ? {
              noteTasks: input.relatedTaskIds
                .map((taskId) => tasks.find((task) => task.id === taskId))
                .filter((task): task is NonNullable<typeof task> => !!task)
                .map((task) => ({ task: { id: task.id, title: task.title } })),
            }
          : {}),
        updatedAt: new Date(),
      })
      return note
    },
    async upsertNoteLink(_userId, input) {
      const existing = noteLinks.find((link) => link.fromNoteId === input.fromNoteId && link.toNoteId === input.toNoteId)
      if (existing) {
        existing.relationType = input.relationType
        return { ...existing, id: nextId("notelink") }
      }
      const created = {
        id: nextId("notelink"),
        fromNoteId: input.fromNoteId,
        toNoteId: input.toNoteId,
        relationType: input.relationType,
      }
      noteLinks.push(created)
      return created
    },
  }

  return {
    repository,
    db: {
      tasks,
      notes,
      tags,
      inbox,
      noteLinks,
    },
  }
}
