import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('🗑️  Clearing all data...')
  await prisma.reviewLog.deleteMany({})
  await prisma.noteTag.deleteMany({})
  await prisma.noteTask.deleteMany({})
  await prisma.noteLink.deleteMany({})
  await prisma.taskTag.deleteMany({})
  await prisma.subTask.deleteMany({})
  await prisma.inboxItem.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.task.deleteMany({})
  await prisma.tag.deleteMany({})
  console.log('✅ All data cleared!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
