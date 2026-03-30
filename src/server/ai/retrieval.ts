import { deriveSearchQueries, normalizeTitleForMatch } from "@/server/ai/normalization"

export type AiTaskRecord = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueAt: Date | null
  reminderAt: Date | null
  updatedAt: Date
  subTasks: Array<{ id: string; title: string; done: boolean }>
  timeBlocks: Array<{ id: string; startAt: Date; endAt: Date; isAllDay: boolean; subTaskId: string | null }>
}

export type AiNoteRecord = {
  id: string
  title: string
  summary: string
  contentMd: string
  type: string
  importance: string
  updatedAt: Date
  noteTasks: Array<{ task: { id: string; title: string } }>
}

export type CandidateMatch<T> = {
  item: T
  score: number
  strategy: "exact_title" | "normalized_title" | "search_query" | "recency"
}

function scoreRecency(updatedAt: Date) {
  const ageHours = Math.max((Date.now() - updatedAt.getTime()) / 3600000, 0)
  return Math.max(0, 20 - Math.min(ageHours / 12, 20))
}

function rankTitleMatch(title: string, query: string) {
  const normalizedTitle = normalizeTitleForMatch(title)
  const normalizedQuery = normalizeTitleForMatch(query)
  if (!normalizedTitle || !normalizedQuery) return null
  if (title.trim().toLowerCase() === query.trim().toLowerCase()) {
    return { score: 100, strategy: "exact_title" as const }
  }
  if (normalizedTitle === normalizedQuery) {
    return { score: 90, strategy: "normalized_title" as const }
  }
  if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    return { score: 75, strategy: "search_query" as const }
  }
  return null
}

export function resolveTaskCandidate(
  tasks: AiTaskRecord[],
  params: {
    title?: string | null
    query?: string | null
  },
): CandidateMatch<AiTaskRecord> | null {
  const queries = [params.title, params.query, ...deriveSearchQueries(`${params.title ?? ""} ${params.query ?? ""}`)]
    .filter((item): item is string => !!item && item.trim().length > 0)

  let best: CandidateMatch<AiTaskRecord> | null = null

  for (const task of tasks) {
    for (const query of queries) {
      const ranked = rankTitleMatch(task.title, query)
      if (!ranked) continue
      const score = ranked.score + scoreRecency(task.updatedAt)
      if (!best || score > best.score) {
        best = { item: task, score, strategy: ranked.strategy }
      }
    }
  }

  if (best) return best
  const recent = [...tasks]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .find((task) => queries.some((query) => normalizeTitleForMatch(task.description ?? "").includes(normalizeTitleForMatch(query))))
  return recent ? { item: recent, score: 40, strategy: "recency" } : null
}

export function resolveNoteCandidate(
  notes: AiNoteRecord[],
  params: {
    title?: string | null
    query?: string | null
  },
): CandidateMatch<AiNoteRecord> | null {
  const queries = [params.title, params.query, ...deriveSearchQueries(`${params.title ?? ""} ${params.query ?? ""}`)]
    .filter((item): item is string => !!item && item.trim().length > 0)

  let best: CandidateMatch<AiNoteRecord> | null = null
  for (const note of notes) {
    for (const query of queries) {
      const ranked = rankTitleMatch(note.title, query)
      if (ranked) {
        const score = ranked.score + scoreRecency(note.updatedAt)
        if (!best || score > best.score) {
          best = { item: note, score, strategy: ranked.strategy }
        }
        continue
      }

      const normalizedQuery = normalizeTitleForMatch(query)
      const haystack = normalizeTitleForMatch(`${note.summary} ${note.contentMd}`)
      if (normalizedQuery && haystack.includes(normalizedQuery)) {
        const score = 65 + scoreRecency(note.updatedAt)
        if (!best || score > best.score) {
          best = { item: note, score, strategy: "search_query" }
        }
      }
    }
  }

  return best
}

export function hasExistingTaskOccurrence(
  tasks: AiTaskRecord[],
  title: string,
  params: {
    reminderAt?: string | null
    dueAt?: string | null
  },
) {
  const normalized = normalizeTitleForMatch(title)
  return tasks.find((task) => {
    if (normalizeTitleForMatch(task.title) !== normalized) return false
    if (params.reminderAt && task.reminderAt?.toISOString() === params.reminderAt) return true
    if (params.dueAt && task.dueAt?.toISOString() === params.dueAt) return true
    return false
  }) ?? null
}

export function hasExistingTimeBlock(
  task: AiTaskRecord,
  params: {
    startAt: string
    endAt: string
  },
) {
  return task.timeBlocks.find(
    (block) => !block.isAllDay && block.startAt.toISOString() === params.startAt && block.endAt.toISOString() === params.endAt,
  ) ?? null
}
