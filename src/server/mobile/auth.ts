import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getStoredUserSettings, resolveEffectiveUserContext } from "@/server/preferences"
import { badRequest, conflict, notFound, unauthorized } from "@/server/errors"
import { normalizeTimeZone } from "@/server/time"

const MOBILE_SESSION_TTL_DAYS = Number(process.env.MOBILE_SESSION_TTL_DAYS ?? "90")

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url")
}

function sessionExpiryDate() {
  return new Date(Date.now() + MOBILE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export async function registerMobileUser(input: {
  username: string
  password: string
  deviceName?: string
  deviceId?: string
}) {
  const existing = await prisma.user.findUnique({ where: { name: input.username } })
  if (existing) {
    throw conflict("Username already exists", "username_taken")
  }

  const passwordHash = await bcrypt.hash(input.password, 10)
  const user = await prisma.user.create({
    data: {
      name: input.username,
      password: passwordHash,
    },
  })

  const session = await createMobileSession({
    userId: user.id,
    deviceName: input.deviceName,
    deviceId: input.deviceId,
  })

  return { user, session }
}

export async function loginMobileUser(input: {
  username: string
  password: string
  deviceName?: string
  deviceId?: string
}) {
  const user = await prisma.user.findUnique({ where: { name: input.username } })
  if (!user) {
    throw unauthorized("Invalid username or password", "invalid_credentials")
  }

  const valid = await bcrypt.compare(input.password, user.password)
  if (!valid) {
    throw unauthorized("Invalid username or password", "invalid_credentials")
  }

  const session = await createMobileSession({
    userId: user.id,
    deviceName: input.deviceName,
    deviceId: input.deviceId,
  })

  return { user, session }
}

export async function createMobileSession(input: {
  userId: string
  deviceName?: string
  deviceId?: string
}) {
  const token = generateOpaqueToken()
  const tokenHash = hashToken(token)
  const expiresAt = sessionExpiryDate()

  const session = await prisma.mobileSession.create({
    data: {
      userId: input.userId,
      tokenHash,
      deviceName: input.deviceName,
      deviceId: input.deviceId,
      expiresAt,
    },
  })

  return { session, token }
}

export async function revokeMobileSessionByToken(token: string) {
  const tokenHash = hashToken(token)
  await prisma.mobileSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function requireMobileSession(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) {
    throw unauthorized("Missing bearer token", "missing_bearer_token")
  }

  const token = authorization.slice("Bearer ".length).trim()
  if (!token) {
    throw unauthorized("Missing bearer token", "missing_bearer_token")
  }

  const tokenHash = hashToken(token)
  const session = await prisma.mobileSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  })

  if (!session) {
    throw unauthorized("Session expired or revoked", "invalid_session")
  }

  await prisma.mobileSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return { session, user: session.user, rawToken: token }
}

export async function buildAuthenticatedMobileContext(
  request: Request,
  auth: Awaited<ReturnType<typeof requireMobileSession>>,
) {
  const storedSettings = await getStoredUserSettings(auth.user.id)
  const context = resolveEffectiveUserContext(storedSettings, {
    locale: request.headers.get("x-locale"),
    timezone: request.headers.get("x-timezone"),
  })

  return {
    user: auth.user,
    session: auth.session,
    token: auth.rawToken,
    settings: context,
  }
}

export async function getMeResponse(request: Request) {
  const auth = await requireMobileSession(request)
  return buildAuthenticatedMobileContext(request, auth)
}

export function normalizeRequestedTimezone(value: string | null | undefined) {
  return normalizeTimeZone(value)
}
