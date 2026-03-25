import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { getSession } from "@/lib/auth"

const FALLBACK_PUBLIC_ORIGIN = "http://localhost:3003"

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

function toAbsoluteOrigin(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return isLocalHost(url.hostname) ? null : url.origin
  } catch {
    return null
  }
}

function sanitizeFrom(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

function tryParseUrl(value: string | null) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  session.destroy()

  const requestUrl = new URL(request.url)
  const headersList = await headers()
  const referer = headersList.get("referer")
  const explicitFrom = requestUrl.searchParams.get("from")
  const refererUrl = tryParseUrl(referer)
  const forwardedProto = headersList.get("x-forwarded-proto")
  const forwardedHost = headersList.get("x-forwarded-host")
  const forwardedOrigin = forwardedHost
    ? `${forwardedProto === "https" ? "https" : "http"}://${forwardedHost}`
    : null
  const configuredOrigin = toAbsoluteOrigin(process.env.NEXT_PUBLIC_APP_URL ?? null)

  const publicOrigin = [
    toAbsoluteOrigin(referer),
    toAbsoluteOrigin(headersList.get("origin")),
    toAbsoluteOrigin(forwardedOrigin),
    configuredOrigin,
  ].find(Boolean) ?? FALLBACK_PUBLIC_ORIGIN

  const loginUrl = new URL("/login", publicOrigin)
  loginUrl.searchParams.set("from", sanitizeFrom(explicitFrom ?? refererUrl?.pathname ?? "/"))

  return NextResponse.redirect(loginUrl, 303)
}
