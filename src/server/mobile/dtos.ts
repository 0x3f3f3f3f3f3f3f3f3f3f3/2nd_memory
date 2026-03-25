import type {
  InboxItem,
  Note,
  NoteTag,
  NoteTask,
  ProcessType,
  Setting,
  SubTask,
  Tag,
  Task,
  TaskTag,
  TimeBlock,
  User,
} from "@prisma/client"
import { toIsoString } from "@/server/time"
import type { EffectiveUserContext } from "@/server/preferences"

export interface UserDTO {
  id: string
  username: string
  createdAt: string
}

export interface UserSettingsDTO {
  language: "zh-Hans" | "en"
  theme: "light" | "dark" | "system"
  timezoneMode: "system" | "manual"
  timezoneOverride: string | null
  effectiveTimezone: string
}

export interface TagDTO {
  id: string
  name: string
  slug: string
  color: string
  icon: string | null
  description: string | null
  sortOrder: number
  taskCount?: number
  noteCount?: number
  createdAt: string
  updatedAt: string
}

export interface SubTaskDTO {
  id: string
  title: string
  done: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TimeBlockDTO {
  id: string
  taskId: string
  startAt: string
  endAt: string
  isAllDay: boolean
  createdAt: string
  updatedAt: string
}

export interface TaskDTO {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueAt: string | null
  reminderAt: string | null
  completedAt: string | null
  estimateMinutes: number | null
  isPinned: boolean
  sortOrder: number
  sourceNoteId: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  tags: TagDTO[]
  subtasks: SubTaskDTO[]
  timeBlocks?: TimeBlockDTO[]
}

export interface NoteDTO {
  id: string
  title: string
  slug: string
  summary: string
  contentMd: string
  type: string
  importance: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  tags: TagDTO[]
  relatedTasks: Pick<TaskDTO, "id" | "title" | "status" | "priority" | "dueAt">[]
}

export interface InboxItemDTO {
  id: string
  content: string
  capturedAt: string
  processedAt: string | null
  processType: ProcessType
}

export interface SearchResultDTO {
  tasks: Pick<TaskDTO, "id" | "title" | "status" | "priority" | "dueAt">[]
  notes: Pick<NoteDTO, "id" | "title" | "slug" | "summary" | "type">[]
  tags: Pick<TagDTO, "id" | "name" | "slug" | "color">[]
}

type TaskRecord = Task & {
  taskTags: (TaskTag & { tag: Tag })[]
  subTasks: SubTask[]
  timeBlocks?: TimeBlock[]
}

type NoteRecord = Note & {
  noteTags: (NoteTag & { tag: Tag })[]
  noteTasks?: (NoteTask & {
    task: Task & {
      taskTags?: (TaskTag & { tag: Tag })[]
      subTasks?: SubTask[]
    }
  })[]
}

export function serializeUser(user: User): UserDTO {
  return {
    id: user.id,
    username: user.name,
    createdAt: user.createdAt.toISOString(),
  }
}

export function serializeUserSettings(context: EffectiveUserContext): UserSettingsDTO {
  return {
    language: context.language,
    theme: context.theme,
    timezoneMode: context.timezoneMode,
    timezoneOverride: context.timezoneOverride,
    effectiveTimezone: context.timezone,
  }
}

export function serializeTag(tag: Tag & {
  _count?: { taskTags?: number; noteTags?: number }
}): TagDTO {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    color: tag.color,
    icon: tag.icon ?? null,
    description: tag.description ?? null,
    sortOrder: tag.sortOrder,
    taskCount: tag._count?.taskTags,
    noteCount: tag._count?.noteTags,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  }
}

export function serializeSubTask(subTask: SubTask): SubTaskDTO {
  return {
    id: subTask.id,
    title: subTask.title,
    done: subTask.done,
    sortOrder: subTask.sortOrder,
    createdAt: subTask.createdAt.toISOString(),
    updatedAt: subTask.updatedAt.toISOString(),
  }
}

export function serializeTimeBlock(timeBlock: TimeBlock): TimeBlockDTO {
  return {
    id: timeBlock.id,
    taskId: timeBlock.taskId,
    startAt: timeBlock.startAt.toISOString(),
    endAt: timeBlock.endAt.toISOString(),
    isAllDay: timeBlock.isAllDay,
    createdAt: timeBlock.createdAt.toISOString(),
    updatedAt: timeBlock.updatedAt.toISOString(),
  }
}

export function serializeTask(task: TaskRecord): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueAt: toIsoString(task.dueAt),
    reminderAt: toIsoString(task.reminderAt),
    completedAt: toIsoString(task.completedAt),
    estimateMinutes: task.estimateMinutes ?? null,
    isPinned: task.isPinned,
    sortOrder: task.sortOrder,
    sourceNoteId: task.sourceNoteId ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    archivedAt: toIsoString(task.archivedAt),
    tags: task.taskTags.map(({ tag }) => serializeTag(tag)),
    subtasks: task.subTasks.map(serializeSubTask),
    timeBlocks: task.timeBlocks?.map(serializeTimeBlock),
  }
}

export function serializeNote(note: NoteRecord): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    slug: note.slug,
    summary: note.summary,
    contentMd: note.contentMd,
    type: note.type,
    importance: note.importance,
    isPinned: note.isPinned,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    archivedAt: toIsoString(note.archivedAt),
    tags: note.noteTags.map(({ tag }) => serializeTag(tag)),
    relatedTasks:
      note.noteTasks?.map(({ task }) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueAt: toIsoString(task.dueAt),
      })) ?? [],
  }
}

export function serializeInboxItem(item: InboxItem): InboxItemDTO {
  return {
    id: item.id,
    content: item.content,
    capturedAt: item.capturedAt.toISOString(),
    processedAt: toIsoString(item.processedAt),
    processType: item.processType,
  }
}
