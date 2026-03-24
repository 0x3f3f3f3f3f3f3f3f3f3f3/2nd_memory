import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { InboxList } from "@/components/inbox/inbox-list"
import { QuickAdd } from "@/components/shared/quick-add"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "收件箱" }

export default async function InboxPage() {
  const { t } = await getServerT()
  const items = await prisma.inboxItem.findMany({
    where: { userId: OWNER_USER_ID, processedAt: null },
    orderBy: { capturedAt: "desc" },
  })

  return (
    <div className="flex flex-col">
      <Topbar title={t.inbox.pageTitle} subtitle={t.inbox.subtitle(items.length)} actions={<QuickAdd />} />
      <div className="flex-1 p-4 md:p-6">
        <InboxList items={items} />
      </div>
    </div>
  )
}
