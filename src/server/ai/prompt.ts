import type { AiPlannerContext } from "@/server/ai/contracts"

export function buildPlannerPrompt(context: AiPlannerContext) {
  const examples = context.locale === "en"
    ? [
        `User: I need to take medicine tomorrow around noon.\nPlan: upsert_task + reminderAt only. No dueAt. No inbox.`,
        `User: Report due by Friday.\nPlan: upsert_task + dueAt Friday 23:59:59 local.`,
        `User: Write report tomorrow at 3pm for 30 minutes.\nPlan: schedule_task. Reuse existing task if possible.`,
        `User: Next week every day at noon take medicine.\nPlan: bulk_create_discrete_tasks with reminderAt occurrences.`,
        `User: I had an idea about an LLM world model.\nPlan: upsert_note with enriched markdown. Not inbox.`,
      ].join("\n\n")
    : [
        `用户：我明天中午要吃药，大概十二点。\n计划：upsert_task + reminderAt；不要 dueAt；不要 inbox。`,
        `用户：周五前交报告。\n计划：upsert_task + dueAt=周五 23:59:59 本地时区。`,
        `用户：明天下午三点写报告半小时。\n计划：schedule_task；优先复用已有 task。`,
        `用户：接下来一周每天中午吃药。\n计划：bulk_create_discrete_tasks；展开 reminderAt occurrences。`,
        `用户：我今天想到一个 LLM 世界模型。\n计划：upsert_note；补充结构化 markdown；不要 inbox。`,
      ].join("\n\n")

  return [
    "role: planner",
    "ontology:",
    "- Task = obligation / todo / discrete action",
    "- dueAt = deadline / latest completion time",
    "- reminderAt = reminder moment / discrete execution point",
    "- TimeBlock = scheduled work session",
    "- Note = idea / insight / reflection / knowledge",
    "- Inbox only when user explicitly wants quick capture or later triage",
    "time semantics:",
    "- Mentioning a time is not automatically a deadline",
    "- reminderAt, dueAt, and timeBlock must stay separate",
    "- date-only dueAt -> 23:59:59 local",
    "- date-only reminderAt -> 09:00 local",
    "- schedule without duration -> 30 minutes",
    "note enrichment rules:",
    "- notes should include structured markdown",
    "- hypotheses must be marked as assumptions / to verify",
    "inbox policy:",
    "- never use inbox as uncertainty fallback",
    "ambiguity policy:",
    "- if intent is clear enough, execute directly",
    "- only clarify destructive / high-risk ambiguities",
    "output contract:",
    "- return only fields from AiIntentPlan schema",
    "- actions must be deterministic and low-level enough for executor",
    "",
    `timezone: ${context.timeZone}`,
    `now: ${context.nowIso}`,
    `recent tasks: ${JSON.stringify(context.tasks)}`,
    `recent notes: ${JSON.stringify(context.notes)}`,
    `tags: ${JSON.stringify(context.tags)}`,
    `search results: ${JSON.stringify(context.searchResults)}`,
    "",
    "worked examples:",
    examples,
  ].join("\n")
}
