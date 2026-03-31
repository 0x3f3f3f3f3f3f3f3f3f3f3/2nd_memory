import { addDays } from "date-fns"
import { TZDate } from "@date-fns/tz"
import { RECURRING_EXPANSION_LIMIT } from "@/server/ai/contracts"
import { normalizeWhitespace } from "@/server/ai/normalization"

export const COARSE_TIME_MAP = {
  morning: { hour: 9, minute: 0 },
  forenoon: { hour: 10, minute: 0 },
  noon: { hour: 12, minute: 0 },
  afternoon: { hour: 15, minute: 0 },
  dusk: { hour: 18, minute: 0 },
  evening: { hour: 20, minute: 0 },
} as const

const WEEKDAY_MAP: Record<string, number> = {
  "周一": 1,
  "星期一": 1,
  monday: 1,
  mon: 1,
  "周二": 2,
  "星期二": 2,
  tuesday: 2,
  tue: 2,
  tues: 2,
  "周三": 3,
  "星期三": 3,
  wednesday: 3,
  wed: 3,
  "周四": 4,
  "星期四": 4,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  "周五": 5,
  "星期五": 5,
  friday: 5,
  fri: 5,
  "周六": 6,
  "星期六": 6,
  saturday: 6,
  sat: 6,
  "周日": 0,
  "周天": 0,
  "星期日": 0,
  "星期天": 0,
  sunday: 0,
  sun: 0,
}

export type ParsedTimePoint = {
  at: Date
  localDateKey: string
}

export type ParsedRecurringWindow = {
  days: number
}

export function zonedNowForTime(timeZone: string, now = new Date()) {
  return new TZDate(now, timeZone)
}

export function formatLocalDateKey(date: Date, timeZone: string) {
  const zoned = new TZDate(date, timeZone)
  const month = `${zoned.getMonth() + 1}`.padStart(2, "0")
  const day = `${zoned.getDate()}`.padStart(2, "0")
  return `${zoned.getFullYear()}-${month}-${day}`
}

function makeZonedDate(timeZone: string, year: number, month: number, day: number, hour: number, minute: number, second = 0) {
  const zoned = new TZDate(year, month, day, hour, minute, second, timeZone)
  return new Date(zoned.toISOString())
}

function resolveRelativeDay(text: string, timeZone: string, now = new Date()) {
  const source = normalizeWhitespace(text).toLowerCase()
  const zoned = zonedNowForTime(timeZone, now)

  if (source.includes("后天")) {
    return new TZDate(addDays(zoned, 2), timeZone)
  }
  if (source.includes("明天") || source.includes("tomorrow")) {
    return new TZDate(addDays(zoned, 1), timeZone)
  }
  if (source.includes("今天") || source.includes("today")) {
    return zoned
  }

  for (const [token, day] of Object.entries(WEEKDAY_MAP)) {
    if (!source.includes(token)) continue
    const current = zoned.getDay()
    let delta = (day - current + 7) % 7
    if (delta === 0) delta = 7
    return new TZDate(addDays(zoned, delta), timeZone)
  }

  return zoned
}

function resolveCoarseTime(text: string) {
  const source = normalizeWhitespace(text).toLowerCase()
  if (source.includes("中午") || source.includes("noon")) return COARSE_TIME_MAP.noon
  if (source.includes("下午") || source.includes("afternoon")) return COARSE_TIME_MAP.afternoon
  if (source.includes("傍晚")) return COARSE_TIME_MAP.dusk
  if (source.includes("晚上") || source.includes("今晚") || source.includes("evening") || source.includes("tonight")) return COARSE_TIME_MAP.evening
  if (source.includes("上午") || source.includes("forenoon")) return COARSE_TIME_MAP.forenoon
  if (source.includes("早上") || source.includes("早晨") || source.includes("morning")) return COARSE_TIME_MAP.morning
  return null
}

function resolveExplicitTime(text: string) {
  const source = normalizeWhitespace(text).toLowerCase()
  const halfHourMatch = source.match(/(\d{1,2})\s*点半/u)
  if (halfHourMatch) {
    let hour = Number(halfHourMatch[1])
    if (source.includes("下午") || source.includes("晚上") || source.includes("今晚")) {
      if (hour < 12) hour += 12
    }
    if (source.includes("中午") && hour < 11) hour += 12
    return { hour: hour % 24, minute: 30 }
  }

  const match = source.match(/(\d{1,2})(?:[:：点](\d{1,2}))?\s*(am|pm)?/u)
  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]

  if (meridiem === "pm" && hour < 12) hour += 12
  if (meridiem === "am" && hour === 12) hour = 0

  if (!meridiem) {
    if (source.includes("下午") || source.includes("晚上") || source.includes("今晚")) {
      if (hour < 12) hour += 12
    }
    if (source.includes("中午") && hour < 11) hour += 12
  }

  return { hour: hour % 24, minute }
}

export function parseDurationMinutes(text: string, fallbackMinutes = 30) {
  const source = normalizeWhitespace(text).toLowerCase()
  if (source.includes("半小时") || source.includes("half hour")) return 30
  const hourMatch = source.match(/(\d+)\s*(?:小时|hour|hours|h)\b/u)
  const minuteMatch = source.match(/(\d+)\s*(?:分钟|minute|minutes|mins|min)\b/u)
  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0
  const total = hours * 60 + minutes
  return total > 0 ? total : fallbackMinutes
}

export function isDeadlineIntent(text: string) {
  return /(截止|最晚|之前|deadline|due\b|by\b|before\b|提交前|前交|前提交|before submitting)/iu.test(text)
}

export function isReminderIntent(text: string) {
  return /(提醒我|记得|别忘了|吃药|缴费|交费|付费|打电话|开会|去医院|要去医院|要吃药|remember|remind|don't forget|take medicine|take meds)/iu.test(text)
}

export function isScheduleIntent(text: string) {
  return /(安排|schedule|预留|留出|写.*半小时|做.*半小时|\d{1,2}\s*点.*(半小时|\d+\s*分钟|\d+\s*小时)|\d{1,2}[:：]\d{2}.*(半小时|\d+\s*分钟|\d+\s*小时)|\b\d{1,2}\s*(am|pm)\b.*(\d+\s*(分钟|hours?|mins?|min|小时)|半小时)|\b(write|do|work on|run)\b.*\b\d{1,2}\s*(am|pm)\b)/iu.test(text)
}

export function hasExplicitExecutionTime(text: string) {
  return /(\b\d{1,2}[:：]\d{2}\b|\b\d{1,2}\s*(am|pm)\b|\d{1,2}\s*点(?:半|\d{1,2})?)/iu.test(text)
}

export function hasCoarseExecutionSlot(text: string) {
  return /(早上|上午|中午|下午|晚上|傍晚|今晚|明早|明晚|morning|noon|afternoon|evening|tonight)/iu.test(text)
}

export function isRescheduleIntent(text: string) {
  return /(改到|挪到|移到|改成|reschedule|move to|shift to)/iu.test(text)
}

export function isCancelOccurrenceIntent(text: string) {
  return /(取消|删掉这段|删掉这次|cancel)/iu.test(text)
}

export function isWorkSessionVerb(text: string) {
  return /(写|写报告|写论文|做预算|做ppt|study|practice|work on|整理|复习|背|练|看论文|读论文|跑步)/iu.test(text)
}

export function isDiscreteActionVerb(text: string) {
  return /(吃药|吃维生素|打电话|缴费|交水电费|去医院|复诊|开会|拿快递|买猫粮|付费|给妈妈打电话|take medicine|call|pay|go to the hospital|meeting)/iu.test(text)
}

export function isExplicitInboxIntent(text: string) {
  return /(先记一下|放收件箱|放到收件箱|capture|quick capture|稍后处理|晚点再整理)/iu.test(text)
}

export function parseRecurringWindow(text: string): ParsedRecurringWindow | null {
  const source = normalizeWhitespace(text)
  if (/(接下来一周|未来一周|next week)/iu.test(source)) {
    return { days: 7 }
  }
  const explicitDayCount = source.match(/接下来(\d+)天/u)
  if (explicitDayCount) {
    return { days: Math.min(Number(explicitDayCount[1]), RECURRING_EXPANSION_LIMIT) }
  }
  return null
}

export function parseTimePoint(
  text: string,
  timeZone: string,
  now = new Date(),
  options?: {
    defaultHour?: number
    defaultMinute?: number
    dateOnlyAsEndOfDay?: boolean
  },
): ParsedTimePoint {
  const day = resolveRelativeDay(text, timeZone, now)
  const explicit = resolveExplicitTime(text)
  const coarse = resolveCoarseTime(text)

  let hour = options?.dateOnlyAsEndOfDay ? 23 : (options?.defaultHour ?? 9)
  let minute = options?.dateOnlyAsEndOfDay ? 59 : (options?.defaultMinute ?? 0)
  let second = options?.dateOnlyAsEndOfDay ? 59 : 0

  if (coarse) {
    hour = coarse.hour
    minute = coarse.minute
    second = 0
  }
  if (explicit) {
    hour = explicit.hour
    minute = explicit.minute
    second = 0
  }

  const at = makeZonedDate(timeZone, day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, second)
  return { at, localDateKey: formatLocalDateKey(at, timeZone) }
}

export function buildOccurrencesFromDailyReminder(
  text: string,
  timeZone: string,
  now = new Date(),
  defaultHour = COARSE_TIME_MAP.noon.hour,
  defaultMinute = COARSE_TIME_MAP.noon.minute,
) {
  const window = parseRecurringWindow(text)
  if (!window) return []
  const first = zonedNowForTime(timeZone, now)
  const explicit = resolveExplicitTime(text)
  const coarse = resolveCoarseTime(text)
  const hour = explicit?.hour ?? coarse?.hour ?? defaultHour
  const minute = explicit?.minute ?? coarse?.minute ?? defaultMinute

  return Array.from({ length: Math.min(window.days, RECURRING_EXPANSION_LIMIT) }).map((_, index) => {
    const day = addDays(first, index)
    const at = makeZonedDate(timeZone, day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
    return {
      reminderAt: at.toISOString(),
      dueAt: null,
      title: undefined,
    }
  })
}

export function buildOccurrencesFromRecurringSchedule(
  text: string,
  timeZone: string,
  now = new Date(),
  defaultDurationMinutes = 30,
) {
  const window = parseRecurringWindow(text)
  if (!window) return []
  const first = zonedNowForTime(timeZone, now)
  const point = parseTimePoint(text, timeZone, now, {
    defaultHour: COARSE_TIME_MAP.morning.hour,
    defaultMinute: COARSE_TIME_MAP.morning.minute,
  })
  const durationMinutes = parseDurationMinutes(text, defaultDurationMinutes)
  const hour = new TZDate(point.at, timeZone).getHours()
  const minute = new TZDate(point.at, timeZone).getMinutes()

  return Array.from({ length: Math.min(window.days, RECURRING_EXPANSION_LIMIT) }).map((_, index) => {
    const day = addDays(first, index)
    const startAt = makeZonedDate(timeZone, day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000)
    return {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      isAllDay: false,
    }
  })
}
