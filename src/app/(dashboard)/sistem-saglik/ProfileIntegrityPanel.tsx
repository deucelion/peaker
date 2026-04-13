"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runProfileIntegrityRepairAction } from "@/lib/actions/superAdminActions";

type Props = {
  summary: {
    missingProfileCount: number;
    orphanProfileCount: number;
    missingOrganizationCount: number;
    invalidRoleCount: number;
    superAdminRoleMismatchCount: number;
  };
};

export default function ProfileIntegrityPanel({ summary }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState<"dry" | "apply" | null>(null);

  async function run(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "apply");
    setMessage(null);
    const res = await runProfileIntegrityRepairAction({ dryRun });
    setRunning(null);
    if (!res || "error" in res) {
      setMessage(("error" in (res || {}) && res?.error) || "Repair islemi basarisiz.");
      return;
    }
    const r = res.result;
    setMessage(
      dryRun
        ? `Dry-run tamamlandi. olasi_orphan_sil=${r.deletedOrphanProfiles}, olasi_create=${r.createdProfiles}, role_norm=${r.normalizedRoles}, org_fill=${r.filledOrganizationIds}, manual_missing_profile=${r.skippedMissingProfiles}`
        : `Repair tamamlandi. orphan_sil=${r.deletedOrphanProfiles}, create=${r.createdProfiles}, role_norm=${r.normalizedRoles}, org_fill=${r.filledOrganizationIds}, manual_missing_profile=${r.skippedMissingProfiles}`
    );
    router.refresh();
  }

  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 space-y-3 min-w-0">
      <p className="text-white text-sm font-black italic uppercase">Profiles Integrity</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 min-w-0">
        <Metric label="Missing profile" value={summary.missingProfileCount} />
        <Metric label="Orphan profile" value={summary.orphanProfileCount} />
        <Metric label="Missing org" value={summary.missingOrganizationCount} />
        <Metric label="Invalid role" value={summary.invalidRoleCount} />
        <Metric label="SA role mismatch" value={summary.superAdminRoleMismatchCount} />
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          type="button"
          disabled={!!running}
          onClick={() => void run(true)}
          className="min-h-11 px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation w-full sm:w-auto sm:hover:bg-white/10"
        >
          {running === "dry" ? "Dry-run..." : "Dry-run repair"}
        </button>
        <button
          type="button"
          disabled={!!running}
          onClick={() => void run(false)}
          className="min-h-11 px-4 py-2 rounded-xl border border-green-500/30 bg-green-500/15 text-green-300 text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation w-full sm:w-auto"
        >
          {running === "apply" ? "Uygulaniyor..." : "Repair uygula"}
        </button>
      </div>
      {message && <p className="text-[10px] text-gray-300 font-bold break-words">{message}</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2 min-w-0">
      <p className="text-[9px] font-black uppercase text-gray-500 min-w-0 break-words leading-tight">{label}</p>
      <p className="text-lg font-black italic text-white leading-none mt-1">{value}</p>
    </div>
  );
}
