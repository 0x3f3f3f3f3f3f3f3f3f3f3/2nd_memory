import { Topbar } from "@/components/layout/topbar"
import { SettingsPanel } from "@/components/settings/settings-panel"

export const metadata = { title: "设置" }

export default async function SettingsPage() {
  return (
    <div className="flex flex-col">
      <Topbar title="设置" />
      <div className="flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto">
        <SettingsPanel />
      </div>
    </div>
  )
}
