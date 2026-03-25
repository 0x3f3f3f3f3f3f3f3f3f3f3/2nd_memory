import { addDays, endOfMonth, endOfWeek, startOfDay, startOfMonth } from "date-fns"
import { TZDate, tz, tzOffset } from "@date-fns/tz"
import { isSameDay } from "date-fns"

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function normalizeTimeZone(value: string | null | undefined, fallback = "UTC") {
  return isValidTimeZone(value) ? value : fallback
}

export function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

export function zonedNow(timeZone: string) {
  return TZDate.tz(timeZone)
}

export function zonedDayRange(timeZone: string, date = new Date()) {
  const zonedDate = new TZDate(date, timeZone)
  const start = new TZDate(
    zonedDate.getFullYear(),
    zonedDate.getMonth(),
    zonedDate.getDate(),
    0,
    0,
    0,
    timeZone,
  )
  const end = addDays(start, 1)
  return { start: new Date(start.toISOString()), end: new Date(end.toISOString()) }
}

export function zonedFilterRange(
  timeZone: string,
  filter: "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH",
  baseDate = new Date(),
) {
  const zonedDate = new TZDate(baseDate, timeZone)
  if (filter === "TODAY") return zonedDayRange(timeZone, zonedDate)
  if (filter === "TOMORROW") return zonedDayRange(timeZone, addDays(zonedDate, 1))

  if (filter === "THIS_WEEK") {
    const start = startOfDay(zonedDate, { in: tz(timeZone) })
    const end = endOfWeek(zonedDate, { weekStartsOn: 1, in: tz(timeZone) })
    return { start: new Date(start.toISOString()), end: new Date(addDays(end, 1).toISOString()) }
  }

  const start = startOfMonth(zonedDate, { in: tz(timeZone) })
  const end = endOfMonth(zonedDate, { in: tz(timeZone) })
  return { start: new Date(start.toISOString()), end: new Date(addDays(end, 1).toISOString()) }
}

export function zonedDateLabel(date: Date | string, timeZone: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function todayStatusForDate(date: Date | string, timeZone: string, baseDate = new Date()) {
  const zonedDate = new TZDate(new Date(date), timeZone)
  const zonedBase = new TZDate(baseDate, timeZone)
  if (isSameDay(zonedDate, zonedBase, { in: tz(timeZone) })) return "today"
  if (isSameDay(zonedDate, addDays(zonedBase, 1), { in: tz(timeZone) })) return "tomorrow"
  return "other"
}

export function timeZoneOffsetString(timeZone: string, date = new Date()) {
  const minutes = tzOffset(timeZone, date)
  const sign = minutes >= 0 ? "+" : "-"
  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0")
  const mins = String(absolute % 60).padStart(2, "0")
  return `${sign}${hours}:${mins}`
}
