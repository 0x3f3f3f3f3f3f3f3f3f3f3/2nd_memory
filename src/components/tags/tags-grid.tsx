import Link from "next/link"
import { Tag } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import type { Tag as TagType } from "@prisma/client"

type TagWithCount = TagType & { _count: { taskTags: number; noteTags: number } }

export function TagsGrid({ tags }: { tags: TagWithCount[] }) {
  if (tags.length === 0) {
    return (
      <EmptyState
        icon={<Tag className="w-10 h-10" />}
        title="还没有标签"
        description="创建标签来组织你的任务和笔记"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/tags/${tag.slug}`}
          className="group block p-4 rounded-xl border border-[--border] bg-[--card] hover:shadow-sm transition-all"
          style={{ borderLeftColor: tag.color, borderLeftWidth: 3 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
            <span className="font-medium text-sm group-hover:text-[--primary] transition-colors">{tag.name}</span>
          </div>
          {tag.description && (
            <p className="text-xs text-[--muted-foreground] mb-3 line-clamp-2">{tag.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-[--muted-foreground]">
            <span>{tag._count.taskTags} 任务</span>
            <span>{tag._count.noteTags} 笔记</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
