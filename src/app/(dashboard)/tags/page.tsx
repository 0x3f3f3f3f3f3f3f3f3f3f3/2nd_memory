import { prisma } from "@/lib/prisma"
import { OWNER_USER_ID } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { TagsGrid } from "@/components/tags/tags-grid"
import { TagFormButton } from "@/components/tags/tag-form-button"

export const metadata = { title: "标签" }

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    where: { userId: OWNER_USER_ID },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { taskTags: true, noteTags: true } },
    },
  })

  return (
    <div className="flex flex-col">
      <Topbar title="标签" actions={<TagFormButton />} />
      <div className="flex-1 p-4 md:p-6">
        <TagsGrid tags={tags} />
      </div>
    </div>
  )
}
