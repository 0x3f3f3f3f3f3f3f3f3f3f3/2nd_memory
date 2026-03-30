import type { AiRouteKind } from "@/server/ai/contracts"
import { isDeadlineIntent, isExplicitInboxIntent, isReminderIntent, isScheduleIntent, parseRecurringWindow } from "@/server/ai/time-semantics"
import { isLikelyQuestionLike } from "@/server/ai/normalization"

export type AiRouteDecision = {
  kind: AiRouteKind
  reason: string
}

function isDestructiveScheduleIntent(text: string) {
  return /(清除所有规划|清除所有安排|清除所有日程|清空未来安排|清除.*安排|清除.*日程|clear all schedules|clear all planning|clear future schedule)/iu.test(text)
}

function isDeleteTasksIntent(text: string) {
  return /(删除所有任务|清空待办|delete all tasks|clear all tasks)/iu.test(text)
}

function isPlannerHeavyIntent(text: string) {
  return /(补充一下|顺便|关联|link|想法|洞见|灵感|反思|agent economy|奖励机制|world model)/iu.test(text)
}

export function classifyAiRoute(text: string): AiRouteDecision {
  const input = text.trim()
  if (!input) return { kind: "NON_DB_CHAT", reason: "empty" }

  if (isLikelyQuestionLike(input) && !isReminderIntent(input) && !isScheduleIntent(input) && !isDeadlineIntent(input) && !isExplicitInboxIntent(input)) {
    return { kind: "NON_DB_CHAT", reason: "non_db_chat" }
  }

  if (isDestructiveScheduleIntent(input) || isDeleteTasksIntent(input)) {
    return { kind: "DESTRUCTIVE_SCHEDULE", reason: "destructive" }
  }

  const recurring = parseRecurringWindow(input)
  if (recurring && /每天|每晚|每周|every day|every night|every week/iu.test(input)) {
    if (isReminderIntent(input) || /吃药|缴费|打电话|开会|医院|维生素/u.test(input)) {
      return { kind: "FAST_RECURRING_REMINDER", reason: "recurring_reminder" }
    }
    return { kind: "FAST_RECURRING_SCHEDULE", reason: "recurring_schedule" }
  }

  if (isReminderIntent(input)) {
    return { kind: "FAST_REMINDER_TASK", reason: "reminder_task" }
  }

  if (isScheduleIntent(input)) {
    return { kind: "FAST_SCHEDULE_TASK", reason: "schedule_task" }
  }

  if (isDeadlineIntent(input)) {
    return { kind: "FAST_DEADLINE_TASK", reason: "deadline_task" }
  }

  if (isExplicitInboxIntent(input) || isPlannerHeavyIntent(input)) {
    return { kind: "FULL_PLANNER", reason: "planner_heavy" }
  }

  return { kind: "NON_DB_CHAT", reason: "fallback_non_db_chat" }
}
