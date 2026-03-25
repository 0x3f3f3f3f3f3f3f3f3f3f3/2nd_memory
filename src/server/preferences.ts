import { prisma } from "@/lib/prisma"
import { normalizeTimeZone } from "@/server/time"
import type { Prisma } from "@prisma/client"

export type AppLanguage = "zh-Hans" | "en"
export type AppTheme = "light" | "dark" | "system"
export type TimezoneMode = "system" | "manual"

export interface UserSettingsRecord {
  language: AppLanguage
  theme: AppTheme
  timezoneMode: TimezoneMode
  timezoneOverride: string | null
}

export interface EffectiveUserContext {
  language: AppLanguage
  theme: AppTheme
  timezone: string
  timezoneMode: TimezoneMode
  timezoneOverride: string | null
}

const DEFAULT_SETTINGS: UserSettingsRecord = {
  language: "zh-Hans",
  theme: "system",
  timezoneMode: "system",
  timezoneOverride: null,
}

const SETTINGS_KEY = "app_preferences"

function isLanguage(value: unknown): value is AppLanguage {
  return value === "zh-Hans" || value === "en"
}

function isTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark" || value === "system"
}

function isTimezoneMode(value: unknown): value is TimezoneMode {
  return value === "system" || value === "manual"
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  const normalized = value?.toLowerCase() ?? ""
  if (normalized.startsWith("en")) return "en"
  return "zh-Hans"
}

export async function getStoredUserSettings(userId: string): Promise<UserSettingsRecord> {
  const setting = await prisma.setting.findUnique({
    where: { userId_key: { userId, key: SETTINGS_KEY } },
  })

  if (!setting || typeof setting.value !== "object" || setting.value === null) {
    return DEFAULT_SETTINGS
  }

  const value = setting.value as Record<string, unknown>
  return {
    language: isLanguage(value.language) ? value.language : DEFAULT_SETTINGS.language,
    theme: isTheme(value.theme) ? value.theme : DEFAULT_SETTINGS.theme,
    timezoneMode: isTimezoneMode(value.timezoneMode) ? value.timezoneMode : DEFAULT_SETTINGS.timezoneMode,
    timezoneOverride: typeof value.timezoneOverride === "string" ? normalizeTimeZone(value.timezoneOverride) : null,
  }
}

export async function saveUserSettings(userId: string, settings: UserSettingsRecord) {
  const value = settings as unknown as Prisma.InputJsonValue
  return prisma.setting.upsert({
    where: { userId_key: { userId, key: SETTINGS_KEY } },
    update: { value },
    create: { userId, key: SETTINGS_KEY, value },
  })
}

export function resolveEffectiveUserContext(
  stored: UserSettingsRecord,
  headers: { locale?: string | null; timezone?: string | null },
): EffectiveUserContext {
  const headerLanguage = normalizeLanguage(headers.locale)
  const headerTimezone = normalizeTimeZone(headers.timezone)
  const timezone =
    stored.timezoneMode === "manual" && stored.timezoneOverride
      ? stored.timezoneOverride
      : headerTimezone

  return {
    language: stored.language ?? headerLanguage,
    theme: stored.theme,
    timezone,
    timezoneMode: stored.timezoneMode,
    timezoneOverride: stored.timezoneOverride,
  }
}

export function getDefaultUserSettings() {
  return DEFAULT_SETTINGS
}
