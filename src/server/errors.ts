export class AppError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
  }
}

export function badRequest(message: string, code = "bad_request") {
  return new AppError(code, message, 400)
}

export function unauthorized(message = "Unauthorized", code = "unauthorized") {
  return new AppError(code, message, 401)
}

export function forbidden(message = "Forbidden", code = "forbidden") {
  return new AppError(code, message, 403)
}

export function notFound(message = "Not found", code = "not_found") {
  return new AppError(code, message, 404)
}

export function conflict(message: string, code = "conflict") {
  return new AppError(code, message, 409)
}
