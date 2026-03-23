import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_COOKIE = 'mg_session'
const SESSION_VALUE = 'authenticated'

// DEV BYPASS: set DEV_AUTO_LOGIN=true in .env to skip password in development
// IMPORTANT: Never enable this in production
const DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN === 'true' && process.env.NODE_ENV === 'development'

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  const expectedPassword = process.env.OWNER_PASSWORD
  if (!expectedPassword) {
    return { success: false, error: '服务器未配置密码，请联系管理员' }
  }
  if (password !== expectedPassword) {
    return { success: false, error: '密码错误' }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ?? false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return { success: true }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect('/login')
}

export async function isAuthenticated(): Promise<boolean> {
  if (DEV_AUTO_LOGIN) return true
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE
}

export async function requireAuth() {
  const authed = await isAuthenticated()
  if (!authed) {
    redirect('/login')
  }
}

// Hardcoded single user ID for private app
export const OWNER_USER_ID = 'owner'
