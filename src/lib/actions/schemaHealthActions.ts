"use server";

import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getSchemaCapabilities, type SchemaCapabilities } from "@/lib/schemaCompat";

export type SchemaHealthSnapshot = SchemaCapabilities & {
  ok: boolean;
};

export async function getSchemaHealthSnapshotForOps(): Promise<
  { snapshot: SchemaHealthSnapshot } | { error: string }
> {
  return withServerActionGuard("schema.getSchemaHealthSnapshotForOps", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) return { error: resolved.error };
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return { error: "Şema tanı tanımlama yalnızca yönetici içindir." };
    }
    const caps = await getSchemaCapabilities();
    return {
      snapshot: {
        ...caps,
        ok: caps.driftWarnings.length === 0,
      },
    };
  });
}
