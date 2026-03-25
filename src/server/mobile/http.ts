import { ZodError } from "zod"
import { NextResponse } from "next/server"
import { AppError } from "@/server/errors"

export interface MobileRequestHeaders {
  locale: string | null
  timezone: string | null
}

export function getMobileRequestHeaders(request: Request): MobileRequestHeaders {
  return {
    locale: request.headers.get("x-locale") ?? request.headers.get("accept-language"),
    timezone: request.headers.get("x-timezone"),
  }
}

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init)
}

export function jsonError(error: { code: string; message: string }, status = 400) {
  return NextResponse.json({ error }, { status })
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(
      {
        code: "validation_error",
        message: error.issues[0]?.message ?? "Validation failed",
      },
      400,
    )
  }

  if (error instanceof AppError) {
    return jsonError({ code: error.code, message: error.message }, error.status)
  }

  console.error(error)
  return jsonError({ code: "internal_error", message: "Internal server error" }, 500)
}

export async function withMobileRoute<T>(handler: () => Promise<T>) {
  try {
    const data = await handler()
    return jsonData(data)
  } catch (error) {
    return handleRouteError(error)
  }
}
