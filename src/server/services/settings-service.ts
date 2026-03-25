import { getStoredUserSettings, saveUserSettings } from "@/server/preferences"
import { normalizeTimeZone } from "@/server/time"

export async function getUserSettings(userId: string) {
  return getStoredUserSettings(userId)
}

export async function updateUserSettings(
  userId: string,
  input: {
    language?: "zh-Hans" | "en"
    theme?: "light" | "dark" | "system"
    timezoneMode?: "system" | "manual"
    timezoneOverride?: string | null
  },
) {
  const current = await getStoredUserSettings(userId)
  const next = {
    language: input.language ?? current.language,
    theme: input.theme ?? current.theme,
    timezoneMode: input.timezoneMode ?? current.timezoneMode,
    timezoneOverride:
      input.timezoneOverride === undefined
        ? current.timezoneOverride
        : input.timezoneOverride
        ? normalizeTimeZone(input.timezoneOverride)
        : null,
  } as const

  if (next.timezoneMode === "system") {
    return saveUserSettings(userId, { ...next, timezoneOverride: null })
  }

  return saveUserSettings(userId, next)
}
