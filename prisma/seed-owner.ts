import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import "dotenv/config"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const hash = await bcrypt.hash("429841lzy", 10)

  const user = await prisma.user.update({
    where: { id: "owner" },
    data: { name: "admin", password: hash },
  })

  console.log(`Updated owner user: id=${user.id}, name=${user.name}, password hashed`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
