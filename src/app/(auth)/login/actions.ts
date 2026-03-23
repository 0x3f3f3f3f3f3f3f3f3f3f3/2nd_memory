"use server"
import { login } from "@/lib/auth"

export async function loginAction(password: string) {
  return login(password)
}
