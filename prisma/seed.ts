import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { addDays, subDays } from 'date-fns'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('🌱 Seeding Memory Garden...')

  // Create owner user
  const user = await prisma.user.upsert({
    where: { id: 'owner' },
    update: {},
    create: { id: 'owner', name: '花园主人' },
  })

  // Tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { userId_slug: { userId: 'owner', slug: 'work' } }, update: {}, create: { userId: 'owner', name: '工作', slug: 'work', color: '#6366f1', sortOrder: 0 } }),
    prisma.tag.upsert({ where: { userId_slug: { userId: 'owner', slug: 'personal' } }, update: {}, create: { userId: 'owner', name: '个人', slug: 'personal', color: '#22c55e', sortOrder: 1 } }),
    prisma.tag.upsert({ where: { userId_slug: { userId: 'owner', slug: 'health' } }, update: {}, create: { userId: 'owner', name: '健康', slug: 'health', color: '#ef4444', sortOrder: 2 } }),
    prisma.tag.upsert({ where: { userId_slug: { userId: 'owner', slug: 'learning' } }, update: {}, create: { userId: 'owner', name: '学习', slug: 'learning', color: '#f97316', sortOrder: 3 } }),
    prisma.tag.upsert({ where: { userId_slug: { userId: 'owner', slug: 'finance' } }, update: {}, create: { userId: 'owner', name: '财务', slug: 'finance', color: '#eab308', sortOrder: 4 } }),
  ])

  const [work, personal, health, learning, finance] = tags

  // Tasks
  const tasks = [
    { title: '完成 Q2 产品规划文档', priority: 'HIGH' as const, dueAt: addDays(new Date(), 2), status: 'TODO' as const, tagIds: [work.id] },
    { title: '给团队发周报', priority: 'MEDIUM' as const, dueAt: new Date(), status: 'TODO' as const, tagIds: [work.id] },
    { title: '复习 TypeScript 高级类型', priority: 'MEDIUM' as const, dueAt: addDays(new Date(), 5), status: 'TODO' as const, tagIds: [learning.id] },
    { title: '每天跑步 30 分钟', priority: 'MEDIUM' as const, dueAt: new Date(), status: 'DOING' as const, tagIds: [health.id] },
    { title: '准备下周一演讲 PPT', priority: 'URGENT' as const, dueAt: addDays(new Date(), 6), status: 'TODO' as const, tagIds: [work.id] },
    { title: '报销上月差旅费用', priority: 'HIGH' as const, dueAt: subDays(new Date(), 2), status: 'TODO' as const, tagIds: [work.id, finance.id] },
    { title: '更新简历', priority: 'LOW' as const, dueAt: addDays(new Date(), 14), status: 'TODO' as const, tagIds: [personal.id] },
    { title: '读《原则》第三章', priority: 'LOW' as const, dueAt: addDays(new Date(), 3), status: 'TODO' as const, tagIds: [learning.id] },
    { title: '预约体检', priority: 'HIGH' as const, dueAt: addDays(new Date(), 7), status: 'TODO' as const, tagIds: [health.id] },
    { title: '整理电脑桌面和文件夹', priority: 'LOW' as const, dueAt: addDays(new Date(), 10), status: 'DONE' as const, tagIds: [personal.id] },
  ]

  for (const t of tasks) {
    const { tagIds, ...data } = t
    const task = await prisma.task.create({ data: { userId: 'owner', sortOrder: 0, ...data } })
    if (tagIds.length) {
      await prisma.taskTag.createMany({ data: tagIds.map((tagId) => ({ taskId: task.id, tagId })) })
    }
  }

  // Notes
  const notes = [
    {
      title: '不要用忙碌感欺骗自己',
      slug: 'dont-fool-yourself-with-busy',
      summary: '忙碌 ≠ 高效。先定义什么是重要的，再决定怎么用时间。',
      contentMd: `## 核心原则\n\n真正的高效是**做正确的事**，而不是把所有事都做完。\n\n### 行动建议\n\n1. 每天开始前，先列出"今天最重要的 3 件事"\n2. 把重要但不紧急的事排到日历上\n3. 学会说不，保护自己的深度工作时间\n\n> "You can do anything, but not everything." — David Allen`,
      type: 'LESSON' as const, importance: 'HIGH' as const, isPinned: true,
      nextReviewAt: new Date(), reviewIntervalDays: 1, tagIds: [work.id, personal.id],
    },
    {
      title: 'TypeScript 泛型高级用法',
      slug: 'typescript-advanced-generics',
      summary: '条件类型、infer 关键字和映射类型是 TS 高级用法的核心。',
      contentMd: `## 条件类型\n\n\`\`\`typescript\ntype IsArray<T> = T extends any[] ? true : false\n\`\`\`\n\n## infer 关键字\n\n\`\`\`typescript\ntype ReturnType<T> = T extends (...args: any[]) => infer R ? R : never\n\`\`\``,
      type: 'LESSON' as const, importance: 'MEDIUM' as const, isPinned: false,
      nextReviewAt: addDays(new Date(), 3), reviewIntervalDays: 3, tagIds: [learning.id],
    },
    {
      title: '人生决策框架：如何做重要选择',
      slug: 'decision-making-framework',
      summary: '站在未来回头看，选择让你更少后悔的那条路。',
      contentMd: `## 贝佐斯的"后悔最小化"框架\n\n想象自己 80 岁回顾人生，哪个选择会让你后悔更少？\n\n## 使用场景\n\n- 换工作 or 继续现在的？\n- 创业 or 稳定？\n- 学新技能 or 深耕现有领域？\n\n## 重要提示\n\n这个框架适用于**人生大决策**，不适用于日常小事。`,
      type: 'DECISION' as const, importance: 'HIGH' as const, isPinned: true,
      nextReviewAt: addDays(new Date(), 7), reviewIntervalDays: 7, tagIds: [personal.id],
    },
    {
      title: '每日复盘模板',
      slug: 'daily-review-template',
      summary: '5分钟每日复盘，积累微小进步。',
      contentMd: `## 模板\n\n**今天完成了什么？**\n\n**今天遇到了什么障碍？**\n\n**明天最重要的 3 件事是什么？**\n\n**今天的情绪状态如何？(1-10)**`,
      type: 'OTHER' as const, importance: 'MEDIUM' as const, isPinned: false,
      nextReviewAt: addDays(new Date(), 14), reviewIntervalDays: 14, tagIds: [personal.id, work.id],
    },
    {
      title: '投资基本原则',
      slug: 'investment-principles',
      summary: '长期主义、分散投资、低成本指数基金是普通人投资的最优解。',
      contentMd: `## 核心原则\n\n1. **时间是最好的朋友** - 复利需要时间\n2. **分散风险** - 不要把鸡蛋放在同一个篮子里\n3. **低成本指数基金** - 大部分主动基金长期跑不赢指数\n4. **定期定额** - 平滑市场波动\n\n## 避免的行为\n\n- 择时入市\n- 频繁交易\n- 追涨杀跌`,
      type: 'FINANCE' as const, importance: 'HIGH' as const, isPinned: false,
      nextReviewAt: addDays(new Date(), 30), reviewIntervalDays: 30, tagIds: [finance.id],
    },
  ]

  for (const n of notes) {
    const { tagIds, ...data } = n
    const note = await prisma.note.create({ data: { userId: 'owner', metadata: {}, ...data } })
    if (tagIds.length) {
      await prisma.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId: note.id, tagId })) })
    }
  }

  // Inbox items
  await prisma.inboxItem.createMany({
    data: [
      { userId: 'owner', content: '和朋友讨论的那个副业想法：做一个 AI 写作助手工具', capturedAt: new Date() },
      { userId: 'owner', content: '买一本《深度工作》，感觉最近很难专注', capturedAt: subDays(new Date(), 1) },
      { userId: 'owner', content: '考虑学一门新语言，Rust 还是 Go？', capturedAt: subDays(new Date(), 2) },
    ],
  })

  console.log('✅ Seed complete!')
  console.log(`   - 1 user`)
  console.log(`   - ${tags.length} tags`)
  console.log(`   - ${tasks.length} tasks`)
  console.log(`   - ${notes.length} notes`)
  console.log(`   - 3 inbox items`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
