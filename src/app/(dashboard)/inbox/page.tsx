import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { InboxList } from "@/components/inbox/inbox-list"
import { QuickAdd } from "@/components/shared/quick-add"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "收件箱" }

export default async function InboxPage() {
  const userId = await getCurrentUserId()
  const { t } = await getServerT()
  const items = await prisma.inboxItem.findMany({
    where: { userId: userId, processedAt: null },
    orderBy: { capturedAt: "desc" },
  })

  return (
    <div className="flex flex-col">
      <Topbar subtitle={t.inbox.subtitle(items.length)} actions={<QuickAdd />} />
      <div className="flex-1 p-4 md:p-6">
        <InboxList items={items} />
      </div>
    </div>
  )
}
