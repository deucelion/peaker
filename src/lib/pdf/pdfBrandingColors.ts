import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

export type PdfHeaderColorRgb = [number, number, number];

const DEFAULT_PDF_HEADER_RGB: PdfHeaderColorRgb = [124, 58, 237];

/** Parse #RRGGBB into jsPDF RGB tuple; falls back to default Peaker primary. */
export function hexColorToPdfRgb(hex: string): PdfHeaderColorRgb {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return DEFAULT_PDF_HEADER_RGB;
  }
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function resolvePdfHeaderColorRgb(
  organizationBranding: OrganizationBranding | null | undefined
): PdfHeaderColorRgb {
  const branding = organizationBranding ?? createDefaultBranding();
  return hexColorToPdfRgb(branding.theme.primary);
}
