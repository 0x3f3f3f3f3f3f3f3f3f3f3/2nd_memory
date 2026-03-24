import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a Date to a "fake" local Date whose getHours()/getDate()/etc
 * return values as they would appear in the given IANA timezone.
 * Works correctly in both Node (UTC) and browser (any timezone).
 */
export function toTz(date: Date | string, tz: string): Date {
  const d = new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d)
  const v = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0')
  return new Date(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'))
}

/** Backward-compat alias */
export function toChina(date: Date | string): Date {
  return toTz(date, 'Asia/Shanghai')
}

/**
 * Formats a UTC Date as a `datetime-local` input value in the **browser's local timezone**.
 * Use this to pre-populate <input type="datetime-local"> from a stored UTC Date.
 * (Do NOT use toISOString().slice(0,16) — that gives UTC time, not local time.)
 */
export function toLocalDatetimeInput(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Current moment shifted to the given timezone (defaults to device tz) */
export function nowInTz(tz?: string): Date {
  return toTz(new Date(), tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
}

/** @deprecated use nowInTz() */
export function chinaNow(): Date {
  return toTz(new Date(), 'Asia/Shanghai')
}

export function formatDate(date: Date | string | null | undefined, fmt = 'MM/dd HH:mm', tz?: string): string {
  if (!date) return ''
  const timezone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  return format(toTz(date, timezone), fmt, { locale: zhCN })
}

export function formatRelative(date: Date | string | null | undefined, tz?: string): string {
  if (!date) return ''
  const timezone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const d = toTz(date, timezone)
  const now = nowInTz(timezone)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = addDays(todayStart, 1)
  const dayAfter = addDays(todayStart, 2)
  if (d >= todayStart && d < tomorrowStart) return '今天'
  if (d >= tomorrowStart && d < dayAfter) return '明天'
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
}

export function isOverdue(date: Date | string | null | undefined, tz?: string): boolean {
  if (!date) return false
  const timezone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  return toTz(date, timezone) < nowInTz(timezone)
}

export function getDueLabel(date: Date | string | null | undefined, tz?: string): string {
  if (!date) return ''
  const timezone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const d = toTz(date, timezone)
  const now = nowInTz(timezone)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = addDays(todayStart, 1)
  const tomorrowEnd = addDays(todayStart, 2)

  if (d < todayStart) return '已逾期'
  if (d < todayEnd) return '今天'
  if (d < tomorrowEnd) return '明天'
  return format(d, 'M月d日', { locale: zhCN })
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '紧急',
}

export const STATUS_LABELS: Record<string, string> = {
  INBOX: '收件箱',
  TODO: '待办',
  DOING: '进行中',
  DONE: '已完成',
  ARCHIVED: '已归档',
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  ADVICE: '建议',
  DECISION: '决策',
  PERSON: '人物',
  LESSON: '经验',
  HEALTH: '健康',
  FINANCE: '财务',
  OTHER: '其他',
}

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
}
