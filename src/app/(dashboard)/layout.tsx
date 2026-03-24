import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PageTransition } from "@/components/shared/page-transition"
import { requireAuth } from "@/lib/auth"
import { LocaleProvider } from "@/contexts/locale-context"
import { cookies } from "next/headers"
import type { Locale } from "@/lib/i18n"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()
  const cookieStore = await cookies()
  const locale = (cookieStore.get("locale")?.value ?? "zh") as Locale
  const timezone = cookieStore.get("tz")?.value ?? "Asia/Shanghai"

  return (
    <LocaleProvider initialLocale={locale} initialTimezone={timezone}>
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 md:ml-[var(--sidebar-width)] flex flex-col min-h-screen overflow-x-hidden pb-20 md:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileNav />
      </div>
    </LocaleProvider>
  )
}
