import type { AiExecutionMutation, AiIntentPlan } from "@/server/ai/contracts"
import { normalizeTimeZone } from "@/server/time"

function formatLocalDateTime(value: string, locale: "zh-Hans" | "en", timeZone: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: locale === "en",
  }).format(new Date(value))
}

function formatTimeRange(startAt: string, endAt: string, locale: "zh-Hans" | "en", timeZone: string) {
  const start = formatLocalDateTime(startAt, locale, timeZone)
  const end = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: locale === "en",
  }).format(new Date(endAt))
  return locale === "en" ? `${start} to ${end}` : `${start}–${end}`
}

function formatTimeOfDayRange(startAt: string, endAt: string, locale: "zh-Hans" | "en", timeZone: string) {
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: locale === "en",
  })
  return `${formatter.format(new Date(startAt))}–${formatter.format(new Date(endAt))}`
}

function summarizeTaskMutation(mutation: Extract<AiExecutionMutation, { type: "task_created" | "task_updated" }>, locale: "zh-Hans" | "en", timeZone: string) {
  const base = mutation.type === "task_created"
    ? (locale === "en" ? `Created task "${mutation.title}"` : `已创建任务「${mutation.title}」`)
    : (locale === "en" ? `Updated task "${mutation.title}"` : `已更新任务「${mutation.title}」`)

  if (mutation.reminderAt) {
    const formatted = formatLocalDateTime(mutation.reminderAt, locale, timeZone)
    return locale === "en" ? `${base}, reminder set for ${formatted}.` : `${base}，提醒时间为 ${formatted}。`
  }
  if (mutation.dueAt) {
    const formatted = formatLocalDateTime(mutation.dueAt, locale, timeZone)
    return locale === "en" ? `${base}, deadline set to ${formatted}.` : `${base}，截止时间为 ${formatted}。`
  }
  return `${base}${locale === "en" ? "." : "。"}`
}

export function buildAiSummary(input: {
  plan: AiIntentPlan
  mutations: AiExecutionMutation[]
  locale: "zh-Hans" | "en"
  timeZone: string
}) {
  const locale = input.locale
  const timeZone = normalizeTimeZone(input.timeZone, "UTC")

  if (input.mutations.length === 0) {
    return input.plan.userFacingSummary
  }

  const recurringReminderCreates = input.mutations.filter(
    (mutation): mutation is Extract<AiExecutionMutation, { type: "task_created" }> =>
      mutation.type === "task_created" && !!mutation.reminderAt,
  )
  if (recurringReminderCreates.length > 1) {
    const titles = new Set(recurringReminderCreates.map((mutation) => mutation.title.replace(/\s+#\d+$/, "")))
    if (titles.size === 1) {
      const title = Array.from(titles)[0]
      return locale === "en"
        ? `Created ${recurringReminderCreates.length} reminder tasks for "${title}".`
        : `已为「${title}」创建提醒任务，共 ${recurringReminderCreates.length} 条。`
    }
  }

  const scheduleCreates = input.mutations.filter(
    (mutation): mutation is Extract<AiExecutionMutation, { type: "time_block_created" }> =>
      mutation.type === "time_block_created",
  )
  if (scheduleCreates.length > 1) {
    const title = scheduleCreates[0].taskTitle
    const first = scheduleCreates[0]
    const sameTimeOfDay = scheduleCreates.every((mutation) => formatTimeOfDayRange(mutation.startAt, mutation.endAt, locale, timeZone) === formatTimeOfDayRange(first.startAt, first.endAt, locale, timeZone))
    if (sameTimeOfDay) {
      const timeRange = formatTimeOfDayRange(first.startAt, first.endAt, locale, timeZone)
      return locale === "en"
        ? `Scheduled "${title}" every day for the coming week at ${timeRange}.`
        : `已为「${title}」安排接下来一周每天 ${timeRange} 的时间块。`
    }
    const last = scheduleCreates[scheduleCreates.length - 1]
    const range = `${formatLocalDateTime(first.startAt, locale, timeZone)} - ${formatLocalDateTime(last.startAt, locale, timeZone)}`
    return locale === "en"
      ? `Scheduled recurring sessions for "${title}" across ${scheduleCreates.length} blocks, starting ${range}.`
      : `已为「${title}」安排重复时段，共 ${scheduleCreates.length} 个时间块，起始于 ${range}。`
  }

  const primary = input.mutations[0]
  switch (primary.type) {
    case "task_created":
    case "task_updated":
      return summarizeTaskMutation(primary, locale, timeZone)
    case "time_block_created":
      return locale === "en"
        ? `Scheduled "${primary.taskTitle}" for ${formatTimeRange(primary.startAt, primary.endAt, locale, timeZone)}.`
        : `已安排「${primary.taskTitle}」在 ${formatTimeRange(primary.startAt, primary.endAt, locale, timeZone)}。`
    case "time_block_reused":
      return locale === "en"
        ? `The schedule for "${primary.taskTitle}" already exists at ${formatTimeRange(primary.startAt, primary.endAt, locale, timeZone)}.`
        : `「${primary.taskTitle}」在 ${formatTimeRange(primary.startAt, primary.endAt, locale, timeZone)} 的安排已存在。`
    case "note_created":
      return locale === "en" ? `Saved note "${primary.title}".` : `已保存笔记「${primary.title}」。`
    case "note_updated":
      return locale === "en" ? `Updated note "${primary.title}".` : `已补充笔记「${primary.title}」。`
    case "note_linked":
      return locale === "en" ? "Linked the related notes." : "已建立相关笔记之间的关联。"
    case "inbox_captured":
      return locale === "en" ? "Captured to inbox for later processing." : "已放入收件箱，稍后再整理。"
    case "future_time_blocks_cleared":
      return locale === "en"
        ? `Cleared ${primary.count} future scheduled blocks while preserving tasks and notes.`
        : `已清除未来安排，共 ${primary.count} 条；任务和笔记都已保留。`
    case "tasks_deleted":
      return locale === "en" ? `Deleted ${primary.count} tasks.` : `已删除 ${primary.count} 个任务。`
    default:
      return input.plan.userFacingSummary
  }
}
