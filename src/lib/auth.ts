import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getIronSession } from "iron-session"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

interface SessionData {
  userId?: string
  username?: string
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "mg_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https") ?? false,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function getCurrentUserId(): Promise<string> {
  const session = await getSession()
  if (!session.userId) {
    redirect("/login")
  }
  return session.userId
}

export async function getCurrentUser(): Promise<{ userId: string; username: string }> {
  const session = await getSession()
  if (!session.userId || !session.username) {
    redirect("/login")
  }
  return { userId: session.userId, username: session.username }
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { name: username } })
  if (!user) {
    return { success: false, error: "用户不存在" }
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return { success: false, error: "密码错误" }
  }

  const session = await getSession()
  session.userId = user.id
  session.username = user.name
  await session.save()

  return { success: true }
}

export async function register(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.user.findUnique({ where: { name: username } })
  if (existing) {
    return { success: false, error: "用户名已存在" }
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name: username, password: hash },
  })

  const session = await getSession()
  session.userId = user.id
  session.username = user.name
  await session.save()

  return { success: true }
}

export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect("/login")
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return !!session.userId
}

export async function requireAuth() {
  const authed = await isAuthenticated()
  if (!authed) {
    redirect("/login")
  }
}
