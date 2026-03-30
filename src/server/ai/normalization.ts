const LEADING_PHRASES = [
  /^请帮我/,
  /^帮我/,
  /^请/,
  /^把/,
  /^我想/,
  /^我今天想到/,
  /^今天想到/,
  /^我想到/,
  /^先记一下[:：]?\s*/,
  /^记一下[:：]?\s*/,
  /^提醒我/,
  /^记得/,
]

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function stripLeadingPhrases(value: string) {
  let next = normalizeWhitespace(value.normalize("NFKC"))
  for (const pattern of LEADING_PHRASES) {
    next = next.replace(pattern, "")
  }
  return normalizeWhitespace(next)
}

export function normalizeTitleForMatch(value: string) {
  return stripLeadingPhrases(value)
    .toLowerCase()
    .replace(/[“”"'‘’`]/g, "")
    .replace(/[，。！？、,.!?;:：；（）()【】\[\]{}<>《》\-_/]/g, " ")
    .replace(/\b(the|a|an|to|for|of|my|me|please|about)\b/g, " ")
    .replace(/\s+/g, "")
}

export function deriveSearchQueries(utterance: string) {
  const normalized = stripLeadingPhrases(utterance)
  const segments = normalized
    .split(/[，。！？,.!?；;、\n]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  const queries = new Set<string>()
  if (normalized) queries.add(normalized)
  for (const segment of segments) {
    queries.add(segment)
    queries.add(segment.replace(/^(明天|今天|后天|接下来一周|接下来|周[一二三四五六日天]|星期[一二三四五六日天])/, "").trim())
  }

  return Array.from(queries)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 2)
    .slice(0, 5)
}

export function deriveTaskTitle(raw: string) {
  return normalizeWhitespace(
    stripLeadingPhrases(raw)
      .replace(/^(接下来一周|接下来|未来一周|未来)\s*/, "")
      .replace(/^(每天|每周|每个工作日)\s*/, "")
      .replace(/^(明天|今天|后天|周[一二三四五六日天]|星期[一二三四五六日天])\s*/, "")
      .replace(/^(早上|上午|中午|下午|傍晚|晚上|今晚)\s*/, "")
      .replace(/^\d{1,2}([:：点]\d{1,2})?\s*/, "")
      .replace(/(半小时|\d+\s*分钟|\d+\s*小时).*$/u, "")
      .replace(/(前|之前|截止).*$/u, "")
  ) || normalizeWhitespace(stripLeadingPhrases(raw))
}

export function deriveNoteTitle(raw: string) {
  const stripped = stripLeadingPhrases(raw)
    .replace(/^(也许可以|是否能|我在想|我觉得)\s*/, "")
  return stripped.length > 28 ? `${stripped.slice(0, 28).trim()}…` : stripped
}

export function splitClauses(value: string) {
  return value
    .split(/[，。！？,.!?；;\n]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
}

export function isLikelyQuestionLike(value: string) {
  return /(什么是|为什么|如何|解释|介绍|聊聊|怎么理解|what is|why|how|explain|tell me about)/iu.test(value)
}
