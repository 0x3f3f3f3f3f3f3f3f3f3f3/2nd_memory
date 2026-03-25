import { z } from "zod"

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  deviceName: z.string().trim().max(120).optional(),
  deviceId: z.string().trim().max(200).optional(),
})

export const registerSchema = loginSchema

export const inboxCreateSchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

export const inboxProcessSchema = z.object({
  processType: z.enum(["TASK", "NOTE", "BOTH"]),
  title: z.string().trim().max(500).optional(),
})

export const taskWriteSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(["INBOX", "TODO", "DOING", "DONE", "ARCHIVED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  reminderAt: z.string().datetime({ offset: true }).optional().nullable(),
  estimateMinutes: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  isPinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
})

export const taskUpdateSchema = taskWriteSchema.partial()

export const subTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
})

export const subTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  done: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const timeBlockCreateSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  isAllDay: z.boolean().default(false),
})

export const timeBlockUpdateSchema = timeBlockCreateSchema.partial()

export const noteWriteSchema = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().max(5000).default(""),
  contentMd: z.string().max(200000).default(""),
  type: z.enum(["ADVICE", "DECISION", "PERSON", "LESSON", "HEALTH", "FINANCE", "OTHER"]).default("OTHER"),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  isPinned: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
  relatedTaskIds: z.array(z.string()).default([]),
})

export const noteUpdateSchema = noteWriteSchema.partial()

export const tagWriteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(30).default("#6366f1"),
  icon: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const tagUpdateSchema = tagWriteSchema.partial()

export const settingsUpdateSchema = z.object({
  language: z.enum(["zh-Hans", "en"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  timezoneMode: z.enum(["system", "manual"]).optional(),
  timezoneOverride: z.string().trim().min(1).max(120).nullable().optional(),
})

export const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    }),
  ).min(1),
  locale: z.enum(["zh-Hans", "en"]).optional(),
  timezone: z.string().optional(),
})
