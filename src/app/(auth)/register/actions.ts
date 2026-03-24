"use server"
import { register } from "@/lib/auth"

export async function registerAction(username: string, password: string) {
  return register(username, password)
}
