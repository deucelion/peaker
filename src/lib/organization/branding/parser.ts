import { createDefaultBranding } from "./defaults";
import {
  mergeBrandingAssetsFromPartial,
  mergeBrandingThemeFromPartial,
  mergeBrandingSectionFromPartial,
} from "./helpers";
import { BRANDING_SCHEMA_VERSION } from "./tokens";
import type { OrganizationBranding, ParseOrganizationBrandingResult } from "./types";
import {
  readNonNegativeIntOrUndefined,
  stripUnknownAssetKeys,
  stripUnknownBrandingKeys,
  stripUnknownThemeKeys,
  validateBranding,
} from "./validation";

/**
 * ADR parse policy:
 * - null / undefined → default branding
 * - schemaVersion yanlis → fail-closed default branding
 * - unknown field → strip
 * - missing field → default ile doldur
 */
export function parseOrganizationBranding(raw: unknown): ParseOrganizationBrandingResult {
  if (raw === null || raw === undefined) {
    return { ok: true, branding: createDefaultBranding() };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return failClosed("non_object");
  }

  const record = stripUnknownBrandingKeys(raw as Record<string, unknown>);
  const defaults = createDefaultBranding();

  const schemaVersionRaw = record.schemaVersion;
  if (schemaVersionRaw !== undefined && schemaVersionRaw !== BRANDING_SCHEMA_VERSION) {
    return failClosed("unsupported_schema");
  }

  const brandingRevision =
    readNonNegativeIntOrUndefined(record.brandingRevision) ?? defaults.brandingRevision;

  const theme = mergeBrandingThemeFromPartial(
    defaults.theme,
    typeof record.theme === "object" && record.theme !== null && !Array.isArray(record.theme)
      ? stripUnknownThemeKeys(record.theme as Record<string, unknown>)
      : {}
  );

  const assets = mergeBrandingAssetsFromPartial(
    defaults.assets,
    typeof record.assets === "object" && record.assets !== null && !Array.isArray(record.assets)
      ? stripUnknownAssetKeys(record.assets as Record<string, unknown>)
      : {}
  );

  const application = mergeBrandingSectionFromPartial(defaults.application, record.application);
  const sidebar = mergeBrandingSectionFromPartial(defaults.sidebar, record.sidebar);
  const pdf = mergeBrandingSectionFromPartial(defaults.pdf, record.pdf);
  const email = mergeBrandingSectionFromPartial(defaults.email, record.email);

  const branding: OrganizationBranding = Object.freeze({
    schemaVersion: BRANDING_SCHEMA_VERSION,
    brandingRevision,
    theme: Object.freeze(theme),
    assets: Object.freeze({
      logo: Object.freeze(assets.logo),
      mark: Object.freeze(assets.mark),
      favicon: Object.freeze(assets.favicon),
    }),
    application: Object.freeze(application),
    sidebar: Object.freeze(sidebar),
    pdf: Object.freeze(pdf),
    email: Object.freeze(email),
  });

  const validation = validateBranding(branding);
  if (!validation.ok) {
    return failClosed("invalid_payload");
  }

  return { ok: true, branding };
}

function failClosed(
  reason: ParseOrganizationBrandingResult extends { ok: false; reason: infer R } ? R : never
): ParseOrganizationBrandingResult {
  return {
    ok: false as const,
    branding: createDefaultBranding(),
    reason,
  };
}

export function normalizeOrganizationBranding(raw: unknown): OrganizationBranding {
  return parseOrganizationBranding(raw).branding;
}

export function isOrganizationBranding(value: unknown): value is OrganizationBranding {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const parsed = parseOrganizationBranding(value);
  return parsed.ok;
}
