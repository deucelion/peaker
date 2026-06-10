// FAZ 31: service-role (admin client) sorgularında organization_id kapsam denetimi.
// Heuristik: tenant tablosuna yapılan her .from("tablo") zincirinin deyim sonuna
// kadar org-scope belirtisi (organization_id / org_id / pk-id filtresi) içermesi
// beklenir. İçermeyenler "bulgu" sayılır ve tenantScopeAudit.test.ts'teki
// denetlenmiş baseline ile karşılaştırılır.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS_DIR = "src/lib/actions";

export const TENANT_TABLES = [
  "payments",
  "profiles",
  "training_schedule",
  "training_participants",
  "private_lesson_packages",
  "private_lesson_sessions",
  "private_lesson_payments",
  "private_lesson_package_events",
  "teams",
  "team_members",
  "athletic_results",
  "athletic_result_notes",
  "training_loads",
  "wellness_reports",
  "athlete_metrics",
  "test_definitions",
  "coach_permissions",
  "athlete_permissions",
  "notifications",
  "locations",
  "athlete_programs",
  "athlete_injury_notes",
  "coach_payout_items",
  "coach_payment_rules",
  "finance_contact_notes",
] as const;

// Zincir içinde org kapsamı / sahiplik göstergesi sayılan desenler.
// Not: pk-id filtreleri (eq("id", ...)) tek başına org kanıtı değildir; bu
// nedenle bu desenle geçen sorguların satır bazlı denetimi baseline'a alınırken
// yapılmıştır (bkz. tenantScopeAudit.test.ts baseline yorumu).
const SCOPE_TOKENS: RegExp[] = [
  /organization_id/,
  /org_id/,
  /\.eq\(\s*["'`]id["'`]/,
  /\.in\(\s*["'`]id["'`]/,
];

export type TenantScopeFinding = {
  file: string;
  table: string;
};

function* walkChains(source: string): Generator<{ table: string; chain: string }> {
  const re = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const table = m[1]!;
    if (!(TENANT_TABLES as readonly string[]).includes(table)) continue;
    const start = m.index;
    let end = start;
    let depth = 0;
    for (let i = start; i < Math.min(source.length, start + 1200); i += 1) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === ";" && depth <= 0) {
        end = i;
        break;
      }
      end = i;
    }
    yield { table, chain: source.slice(start, end + 1) };
  }
}

/**
 * Aksiyon dosyalarını tarar; org-scope belirtisi olmayan tenant tablosu
 * sorgularını (dosya, tablo) bazında sayarak döndürür.
 */
export function scanTenantScopeCounts(rootDir: string = process.cwd()): Map<string, number> {
  const dir = join(rootDir, ACTIONS_DIR);
  const counts = new Map<string, number>();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    const file = `${ACTIONS_DIR}/${name}`;
    const source = readFileSync(join(dir, name), "utf8");
    for (const item of walkChains(source)) {
      const scoped = SCOPE_TOKENS.some((t) => t.test(item.chain));
      if (!scoped) {
        const key = `${file} :: ${item.table}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}
