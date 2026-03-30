import { normalizeWhitespace, stripLeadingPhrases } from "@/server/ai/normalization"

export type ExtractedTitle = {
  title: string
  confidence: number
  rationaleCode:
    | "VERB_OBJECT"
    | "OBJECT_ONLY_AFTER_GENERIC_VERB"
    | "PRACTICE_OBJECT"
    | "REMINDER_OBJECT"
    | "FALLBACK_LOW_CONFIDENCE"
  strippedTokens: string[]
  kind: "task" | "note" | "schedule_subject"
}

const SHELL_PATTERNS = [
  /(接下来一周|未来一周|接下来三天|未来三天|接下来\d+天|未来\d+天)/gu,
  /(每天|每晚|每周|每个工作日|每日上午|每天晚上|每日|every day|every night|every week)/giu,
  /(明天|今天|后天|今晚|下周一|下周二|下周三|下周四|下周五|下周六|下周日|周一|周二|周三|周四|周五|周六|周日|周天|星期一|星期二|星期三|星期四|星期五|星期六|星期天|星期日|tomorrow|today|tonight|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)/giu,
  /(早上|上午|中午|下午|晚上|傍晚|每晚|morning|forenoon|afternoon|evening|noon)/giu,
  /\b\d{1,2}[:：]\d{2}\b/gu,
  /\b\d{1,2}\s*(?:am|pm)\b/giu,
  /(?:\d{1,2}\s*点(?:半|\d{1,2})?)/gu,
  /(?:[零一二两三四五六七八九十百]+点(?:半|[零一二三四五六七八九十百]+分?)?)/gu,
  /(半小时|\d+\s*分钟|\d+\s*小时|\d+\s*(?:minutes?|mins?|hours?|hrs?))/giu,
  /^(?:我|你|他|她|我们|咱们|I|we)\s*/giu,
  /^(?:要|得|需要|想|打算|准备|会|should|need to|must)\s*/giu,
]

const GENERIC_OBJECT_VERBS = ["做", "背", "看", "读", "学"]
const PRACTICE_VERBS = ["练", "练习"]
const KEEP_VERBS = ["写", "交", "提交", "整理", "复习", "查", "查看", "研究", "联系", "打电话", "开会", "跑步"]

function cleanup(text: string) {
  let next = normalizeWhitespace(stripLeadingPhrases(text.normalize("NFKC")))
  const strippedTokens: string[] = []
  for (const pattern of SHELL_PATTERNS) {
    next = next.replace(pattern, (match) => {
      strippedTokens.push(match.trim())
      return " "
    })
  }
  next = normalizeWhitespace(next)
  next = next.replace(/^(?:我|你|他|她|我们|咱们)\s*/u, "")
  next = next.replace(/^(?:要|得|需要|想|打算|准备|会)\s*/u, "")
  next = next.replace(/(?:^|\s)(?:要|得|需要|想|打算|准备|会)\s*/gu, " ")
  next = normalizeWhitespace(next)
  return { text: next, strippedTokens }
}

function objectOnlyTitle(object: string) {
  return normalizeWhitespace(object.replace(/^(一下|一下子)/u, ""))
}

function practiceTitle(object: string) {
  const cleaned = objectOnlyTitle(object)
  if (!cleaned) return cleaned
  if (cleaned.endsWith("练习")) return cleaned
  if (/^(吉他|钢琴|小提琴|鼓|乐器)/u.test(cleaned)) return `${cleaned}练习`
  return cleaned
}

export function extractTitle(raw: string, kind: "task" | "note" | "schedule_subject" = "task"): ExtractedTitle {
  const { text, strippedTokens } = cleanup(raw)
  const cleaned = normalizeWhitespace(text)

  if (!cleaned) {
    return {
      title: normalizeWhitespace(stripLeadingPhrases(raw)),
      confidence: 0.2,
      rationaleCode: "FALLBACK_LOW_CONFIDENCE",
      strippedTokens,
      kind,
    }
  }

  const durationObjectMatch = cleaned.match(/^(做|背|练|写|交|提交|整理|复习|查|查看|研究|看|读|学)(?:\s*)?(?:半小时|\d+\s*分钟|\d+\s*小时|\d+\s*(?:minutes?|mins?|hours?|hrs?))\s*(.+)$/iu)
  if (durationObjectMatch) {
    const verb = durationObjectMatch[1]
    const object = normalizeWhitespace(durationObjectMatch[2])
    if (PRACTICE_VERBS.includes(verb)) {
      return { title: practiceTitle(object), confidence: 0.99, rationaleCode: "PRACTICE_OBJECT", strippedTokens, kind }
    }
    if (GENERIC_OBJECT_VERBS.includes(verb)) {
      return { title: objectOnlyTitle(object), confidence: 0.99, rationaleCode: "OBJECT_ONLY_AFTER_GENERIC_VERB", strippedTokens, kind }
    }
    return { title: `${verb}${object}`, confidence: 0.99, rationaleCode: "VERB_OBJECT", strippedTokens, kind }
  }

  const verbObjectMatch = cleaned.match(/^(写|交|提交|整理|复习|查|查看|研究|联系|打电话|开会|跑步)(.+)?$/u)
  if (verbObjectMatch) {
    const verb = verbObjectMatch[1]
    const object = normalizeWhitespace(verbObjectMatch[2] ?? "")
    const title = object ? `${verb}${object}` : verb
    return { title, confidence: 0.98, rationaleCode: "VERB_OBJECT", strippedTokens, kind }
  }

  const reminderObjectMatch = cleaned.match(/^(吃|喝|缴|交|打)(.+)$/u)
  if (reminderObjectMatch) {
    const verb = reminderObjectMatch[1]
    const object = normalizeWhitespace(reminderObjectMatch[2])
    const title = `${verb}${object}`
    return { title, confidence: 0.97, rationaleCode: "REMINDER_OBJECT", strippedTokens, kind }
  }

  const genericVerbObjectMatch = cleaned.match(/^(做|背|看|读|学)\s*(.+)$/u)
  if (genericVerbObjectMatch) {
    return {
      title: objectOnlyTitle(genericVerbObjectMatch[2]),
      confidence: 0.97,
      rationaleCode: "OBJECT_ONLY_AFTER_GENERIC_VERB",
      strippedTokens,
      kind,
    }
  }

  const practiceVerbMatch = cleaned.match(/^(练|练习)\s*(.+)$/u)
  if (practiceVerbMatch) {
    return {
      title: practiceTitle(practiceVerbMatch[2]),
      confidence: 0.97,
      rationaleCode: "PRACTICE_OBJECT",
      strippedTokens,
      kind,
    }
  }

  const englishVerbObjectMatch = cleaned.match(/^(take|write|submit|study|practice|call|pay|review|read|work on|do)\s+(.+)$/iu)
  if (englishVerbObjectMatch) {
    const verb = englishVerbObjectMatch[1].toLowerCase()
    const object = normalizeWhitespace(englishVerbObjectMatch[2])
    if (verb === "take") {
      return { title: `take ${object}`, confidence: 0.97, rationaleCode: "REMINDER_OBJECT", strippedTokens, kind }
    }
    if (verb === "practice") {
      return { title: `${object} practice`, confidence: 0.97, rationaleCode: "PRACTICE_OBJECT", strippedTokens, kind }
    }
    if (["do", "study", "read"].includes(verb)) {
      return { title: objectOnlyTitle(object), confidence: 0.96, rationaleCode: "OBJECT_ONLY_AFTER_GENERIC_VERB", strippedTokens, kind }
    }
    return { title: `${verb} ${object}`, confidence: 0.97, rationaleCode: "VERB_OBJECT", strippedTokens, kind }
  }

  if (cleaned.length <= 12 && !/(要|需要|每天|晚上|上午|下午|中午|分钟|小时|am|pm)/iu.test(cleaned)) {
    return {
      title: cleaned,
      confidence: 0.96,
      rationaleCode: "OBJECT_ONLY_AFTER_GENERIC_VERB",
      strippedTokens,
      kind,
    }
  }

  return {
    title: cleaned,
    confidence: 0.4,
    rationaleCode: "FALLBACK_LOW_CONFIDENCE",
    strippedTokens,
    kind,
  }
}
