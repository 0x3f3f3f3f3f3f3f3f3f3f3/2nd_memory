import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { requireAuth } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 md:ml-[var(--sidebar-width)] flex flex-col min-h-full overflow-x-hidden pb-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
