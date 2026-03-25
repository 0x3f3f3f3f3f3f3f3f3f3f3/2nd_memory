import { cookies } from "next/headers"
import { getT, type Locale } from "./i18n"

export async function getServerT() {
  const cookieStore = await cookies()
  const locale = (cookieStore.get("locale")?.value ?? "zh") as Locale
  const timezone = cookieStore.get("tz")?.value ?? "UTC"
  return { t: getT(locale), locale, timezone }
}
