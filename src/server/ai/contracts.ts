import { z } from "zod"

export const taskStatusSchema = z.enum(["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"])
export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
export const noteTypeSchema = z.enum(["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"])
export const importanceSchema = z.enum(["LOW", "MEDIUM", "HIGH"])
export const relationTypeSchema = z.enum(["RELATED", "CAUSED_BY", "SUPPORTS", "CONTRADICTS", "REMINDS"])

export const matchStrategySchema = z.enum(["exact_title", "normalized_title", "search_query", "always_create"])
export const noteUpdateStrategySchema = z.enum(["create_new", "replace", "append", "enrich_existing"])

export const occurrenceSpecSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  reminderAt: z.string().datetime({ offset: true }).nullable().optional(),
  startAt: z.string().datetime({ offset: true }).nullable().optional(),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  isAllDay: z.boolean().optional(),
})

export const upsertTaskActionSchema = z.object({
  type: z.literal("upsert_task"),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  reminderAt: z.string().datetime({ offset: true }).nullable().optional(),
  estimateMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
  matchStrategy: matchStrategySchema.optional(),
  targetQuery: z.string().trim().max(300).optional(),
  sourceText: z.string().trim().max(2000).optional(),
})

export const scheduleTaskActionSchema = z.object({
  type: z.literal("schedule_task"),
  taskTitle: z.string().trim().min(1).max(300),
  taskQuery: z.string().trim().max(300).optional(),
  createTaskIfMissing: z.boolean(),
  taskDescriptionIfCreate: z.string().trim().max(4000).optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  isAllDay: z.boolean().optional(),
})

export const createRecurringScheduleActionSchema = z.object({
  type: z.literal("create_recurring_schedule"),
  taskTitle: z.string().trim().min(1).max(300),
  taskQuery: z.string().trim().max(300).optional(),
  createTaskIfMissing: z.boolean(),
  taskDescriptionIfCreate: z.string().trim().max(4000).optional(),
  occurrences: z.array(occurrenceSpecSchema.pick({ startAt: true, endAt: true, isAllDay: true })).min(1).max(30),
})

export const bulkCreateDiscreteTasksActionSchema = z.object({
  type: z.literal("bulk_create_discrete_tasks"),
  titleTemplate: z.string().trim().max(300).optional(),
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  occurrences: z.array(occurrenceSpecSchema.pick({ title: true, dueAt: true, reminderAt: true })).min(1).max(30),
})

export const upsertNoteActionSchema = z.object({
  type: z.literal("upsert_note"),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(1200),
  contentMd: z.string().trim().min(1).max(20000),
  typeHint: noteTypeSchema.optional(),
  importance: importanceSchema.optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
  relatedTaskIds: z.array(z.string()).optional(),
  relatedTaskTitles: z.array(z.string()).optional(),
  updateStrategy: noteUpdateStrategySchema,
  targetQuery: z.string().trim().max(300).optional(),
  sourceText: z.string().trim().max(2000).optional(),
})

export const linkNoteToNoteActionSchema = z.object({
  type: z.literal("link_note_to_note"),
  fromTitle: z.string().trim().max(300).optional(),
  fromId: z.string().trim().max(100).optional(),
  fromQuery: z.string().trim().max(300).optional(),
  toTitle: z.string().trim().max(300).optional(),
  toId: z.string().trim().max(100).optional(),
  toQuery: z.string().trim().max(300).optional(),
  relationType: relationTypeSchema,
})

export const captureToInboxActionSchema = z.object({
  type: z.literal("capture_to_inbox"),
  content: z.string().trim().min(1).max(4000),
})

export const aiActionSchema = z.discriminatedUnion("type", [
  upsertTaskActionSchema,
  scheduleTaskActionSchema,
  createRecurringScheduleActionSchema,
  bulkCreateDiscreteTasksActionSchema,
  upsertNoteActionSchema,
  linkNoteToNoteActionSchema,
  captureToInboxActionSchema,
])

export const aiIntentPlanSchema = z.object({
  mode: z.enum(["execute", "clarify", "refuse"]),
  intentSummary: z.string().trim().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).max(20),
  actions: z.array(aiActionSchema).max(30),
  userFacingSummary: z.string().trim().min(1).max(2000),
})

export type AiIntentPlan = z.infer<typeof aiIntentPlanSchema>
export type AiAction = z.infer<typeof aiActionSchema>
export type UpsertTaskAction = z.infer<typeof upsertTaskActionSchema>
export type ScheduleTaskAction = z.infer<typeof scheduleTaskActionSchema>
export type CreateRecurringScheduleAction = z.infer<typeof createRecurringScheduleActionSchema>
export type BulkCreateDiscreteTasksAction = z.infer<typeof bulkCreateDiscreteTasksActionSchema>
export type UpsertNoteAction = z.infer<typeof upsertNoteActionSchema>
export type LinkNoteToNoteAction = z.infer<typeof linkNoteToNoteActionSchema>

export type AiPlannerContext = {
  nowIso: string
  timeZone: string
  locale: "zh-Hans" | "en"
  tasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    dueAt: string | null
    reminderAt: string | null
    updatedAt: string
    subTaskCount: number
    timeBlockCount: number
  }>
  notes: Array<{
    id: string
    title: string
    summary: string
    updatedAt: string
  }>
  tags: Array<{
    id: string
    name: string
    color: string
  }>
  searchResults: Array<{
    query: string
    tasks: Array<{ id: string; title: string; status: string }>
    notes: Array<{ id: string; title: string }>
    tags: Array<{ id: string; name: string }>
  }>
}

export type AiExecutionMutation =
  | { type: "task_created"; taskId: string; title: string }
  | { type: "task_updated"; taskId: string; title: string }
  | { type: "time_block_created"; taskId: string; taskTitle: string; blockId: string }
  | { type: "time_block_reused"; taskId: string; taskTitle: string; blockId: string }
  | { type: "note_created"; noteId: string; title: string }
  | { type: "note_updated"; noteId: string; title: string }
  | { type: "note_linked"; fromNoteId: string; toNoteId: string; relationType: z.infer<typeof relationTypeSchema> }
  | { type: "inbox_captured"; inboxId: string }

export type AiExecutionResult = {
  plan: AiIntentPlan
  mutations: AiExecutionMutation[]
  userFacingSummary: string
}

export const RECURRING_EXPANSION_LIMIT = 30
