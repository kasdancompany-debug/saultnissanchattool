import { SettingsSidebar } from "@/components/settings/settings-sidebar";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
