import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { ReviewList } from "@/components/notes/review-list"

export const metadata = { title: "复习" }

export default async function ReviewPage() {
  const notes = await prisma.note.findMany({
    where: { userId: OWNER_USER_ID, nextReviewAt: { lte: new Date() }, archivedAt: null },
    include: { noteTags: { include: { tag: true } }, reviewLogs: { orderBy: { reviewedAt: "desc" }, take: 1 } },
    orderBy: { nextReviewAt: "asc" },
  })

  return (
    <div className="flex flex-col">
      <Topbar title="知识复习" subtitle={`${notes.length} 条待复习`} />
      <div className="flex-1 p-4 md:p-6">
        <ReviewList notes={notes} />
      </div>
    </div>
  )
}
