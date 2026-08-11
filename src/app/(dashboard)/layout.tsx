import DashboardLayoutClient from "./DashboardLayoutClient";
import { loadMeAccessServerSnapshot } from "@/lib/auth/meAccessServer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialMeAccess = await loadMeAccessServerSnapshot();

  return (
    <DashboardLayoutClient initialMeAccess={initialMeAccess}>{children}</DashboardLayoutClient>
  );
}
