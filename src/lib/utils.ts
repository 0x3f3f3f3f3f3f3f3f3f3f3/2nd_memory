import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined, fmt = 'MM/dd HH:mm'): string {
  if (!date) return ''
  return format(new Date(date), fmt, { locale: zhCN })
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isToday(d)) return '今天'
  if (isTomorrow(d)) return '明天'
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
}

export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false
  return isPast(new Date(date))
}

export function getDueLabel(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isPast(d) && !isToday(d)) return '已逾期'
  if (isToday(d)) return '今天'
  if (isTomorrow(d)) return '明天'
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

export function calcNextReview(rating: string, currentInterval: number | null): Date {
  const interval = currentInterval ?? 1
  let nextDays: number
  switch (rating) {
    case 'FORGOT':
      nextDays = 1
      break
    case 'VAGUE':
      nextDays = Math.max(1, Math.floor(interval * 0.5))
      break
    case 'REMEMBERED':
      nextDays = Math.round(interval * 2.5)
      break
    case 'EASY':
      nextDays = Math.round(interval * 4)
      break
    default:
      nextDays = 3
  }
  return addDays(new Date(), Math.min(nextDays, 365))
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
