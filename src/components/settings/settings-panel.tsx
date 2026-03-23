"use client"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor, Shield, Download } from "lucide-react"
import { cn } from "@/lib/utils"

export function SettingsPanel() {
  const [theme, setTheme] = useState("system")

  const applyTheme = (t: string) => {
    setTheme(t)
    if (t === "dark") document.documentElement.classList.add("dark")
    else if (t === "light") document.documentElement.classList.remove("dark")
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">外观</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>主题</Label>
            <div className="flex gap-2">
              {[
                { value: "light", label: "亮色", icon: Sun },
                { value: "dark", label: "暗色", icon: Moon },
                { value: "system", label: "跟随系统", icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => applyTheme(value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                    theme === value ? "border-[--primary] bg-[--primary]/10 text-[--primary]" : "border-[--border] hover:bg-[--accent]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">安全</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[--muted-foreground]">
            <Shield className="w-4 h-4" />
            <span>私人应用，单用户访问，数据存储在本地服务器</span>
          </div>
          <Separator />
          <form action="/api/auth/logout" method="POST">
            <Button type="submit" variant="outline" className="text-[--destructive] border-[--destructive]/30 hover:bg-[--destructive]/10">
              退出登录
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">数据</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[--muted-foreground] mb-4">
            所有数据存储在 PostgreSQL 数据库，请定期备份。
          </p>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            导出数据 (即将推出)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
