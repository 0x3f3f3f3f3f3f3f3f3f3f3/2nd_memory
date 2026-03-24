import { Topbar } from "@/components/layout/topbar"
import { SettingsPanel } from "@/components/settings/settings-panel"
import { getServerT } from "@/lib/server-locale"

export const metadata = { title: "设置" }

export default async function SettingsPage() {
  const { t } = await getServerT()

  return (
    <div className="flex flex-col">
      <Topbar title={t.settings.pageTitle} />
      <div className="flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto">
        <SettingsPanel />
      </div>
    </div>
  )
}
