import { prisma } from "@/lib/prisma"
import { notFound } from "@/server/errors"
import { uniqueTagSlug } from "@/server/services/common"

export async function listTags(userId: string) {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          taskTags: true,
          noteTags: true,
        },
      },
    },
  })
}

export async function createTag(
  userId: string,
  input: {
    name: string
    color: string
    icon?: string | null
    description?: string | null
    sortOrder?: number
  },
) {
  const slug = await uniqueTagSlug(userId, input.name)
  return prisma.tag.create({
    data: {
      userId,
      name: input.name,
      slug,
      color: input.color,
      icon: input.icon ?? null,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
    include: {
      _count: {
        select: {
          taskTags: true,
          noteTags: true,
        },
      },
    },
  })
}

export async function updateTag(
  userId: string,
  tagRef: string,
  input: {
    name?: string
    color?: string
    icon?: string | null
    description?: string | null
    sortOrder?: number
  },
) {
  const existing = await findTagByRef(userId, tagRef)
  const slug = input.name && input.name !== existing.name ? await uniqueTagSlug(userId, input.name) : existing.slug
  return prisma.tag.update({
    where: { id: existing.id },
    data: {
      ...input,
      slug,
    },
    include: {
      _count: {
        select: {
          taskTags: true,
          noteTags: true,
        },
      },
    },
  })
}

export async function deleteTag(userId: string, tagRef: string) {
  const existing = await findTagByRef(userId, tagRef)
  await prisma.tag.delete({ where: { id: existing.id } })
}

export async function getTagDetail(userId: string, tagRef: string) {
  const tag = await prisma.tag.findFirst({
    where: {
      userId,
      OR: [{ id: tagRef }, { slug: tagRef }],
    },
    include: {
      _count: {
        select: {
          taskTags: true,
          noteTags: true,
        },
      },
      taskTags: {
        include: {
          task: {
            include: {
              taskTags: { include: { tag: true } },
              subTasks: { orderBy: { sortOrder: "asc" } },
              timeBlocks: { orderBy: { startAt: "asc" } },
            },
          },
        },
      },
      noteTags: {
        include: {
          note: {
            include: {
              noteTags: { include: { tag: true } },
              noteTasks: { include: { task: true } },
            },
          },
        },
      },
    },
  })

  if (!tag) {
    throw notFound("Tag not found", "tag_not_found")
  }

  return tag
}

async function findTagByRef(userId: string, tagRef: string) {
  const tag = await prisma.tag.findFirst({
    where: {
      userId,
      OR: [{ id: tagRef }, { slug: tagRef }],
    },
  })
  if (!tag) {
    throw notFound("Tag not found", "tag_not_found")
  }
  return tag
}
