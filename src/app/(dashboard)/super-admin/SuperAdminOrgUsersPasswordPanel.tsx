"use client";

import { AdminSetPasswordPanel } from "@/components/admin/AdminSetPasswordPanel";

type ProfileRow = {
  id: string;
  role: string;
  full_name: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Org Admin",
  coach: "Koç",
  sporcu: "Sporcu",
};

type Props = {
  profiles: ProfileRow[];
};

export default function SuperAdminOrgUsersPasswordPanel({ profiles }: Props) {
  if (profiles.length === 0) {
    return (
      <section className="ui-card border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
        <p className="text-white text-sm font-black italic uppercase mb-2">Kullanıcı şifreleri</p>
        <p className="text-[10px] text-gray-500 font-bold uppercase">Bu organizasyonda profil yok.</p>
      </section>
    );
  }

  return (
    <section className="ui-card border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0 space-y-4">
      <div>
        <p className="text-white text-sm font-black italic uppercase mb-2">Kullanıcı şifreleri</p>
        <p className="text-[10px] text-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)] font-bold uppercase mb-1 break-words">
          Bu organizasyondaki her kullanıcı için doğrudan yeni şifre atayın.
        </p>
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-4 break-words">
          Super admin: bu organizasyondaki tüm kullanıcılara yeni şifre atayabilir.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        {profiles.map((profile) => (
          <AdminSetPasswordPanel
            key={profile.id}
            targetUserId={profile.id}
            targetName={profile.full_name?.trim() || profile.id.slice(0, 8)}
            targetRoleLabel={ROLE_LABELS[profile.role] || profile.role}
            className="!rounded-[1.25rem] !p-4"
            assumeCanManage
          />
        ))}
      </div>
    </section>
  );
}
