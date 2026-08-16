import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadOrganizationFeatureEditorSnapshot } from "@/lib/actions/organizationFeatureActions";
import { assertSuperAdminPageAccess } from "@/lib/auth/superAdminPageGuard";
import { asSingleDynamicParam } from "@/lib/navigation/dynamicParams";
import { isOrganizationFeaturesRuntimeEnabled } from "@/lib/organization/features/runtime/killSwitch";
import { createServerSupabaseReadClient } from "@/lib/supabase/server-read";
import { isUuid } from "@/lib/validation/uuid";
import OrgPackageEditor from "../../_components/OrgPackageEditor";

interface PageProps {
  params: Promise<{ organizationId: string | string[] | undefined }>;
}

export default async function SuperAdminOrganizationPackagePage({ params }: PageProps) {
  const raw = await params;
  const organizationId = asSingleDynamicParam(raw.organizationId);
  if (!organizationId || !isUuid(organizationId)) {
    notFound();
  }

  const sessionClient = await createServerSupabaseReadClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) redirect("/login");
  await assertSuperAdminPageAccess(
    sessionClient,
    authData.user,
    `/super-admin/${organizationId}/package`
  );

  const loaded = await loadOrganizationFeatureEditorSnapshot(organizationId);
  if (!loaded.ok) {
    if (loaded.errorKind === "not_found") {
      notFound();
    }
    throw new Error(loaded.error);
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(3rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <Link
          href={`/super-admin/${organizationId}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-white/5 ui-card px-4 py-2 text-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)] text-[10px] font-black uppercase touch-manipulation sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] sm:hover:ui-kpi-chip--brand sm:hover:text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]"
        >
          {"<-"} Organizasyon Detayina Don
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter mt-3 break-words leading-tight">
          Paket Yonetimi
        </h1>
        <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.25em] italic mt-2 break-words">
          {loaded.snapshot.organizationName}
        </p>
      </header>

      <OrgPackageEditor
        initialSnapshot={loaded.snapshot}
        runtimeEnabled={isOrganizationFeaturesRuntimeEnabled()}
      />
    </div>
  );
}
