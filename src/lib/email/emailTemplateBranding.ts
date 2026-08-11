import type { EmailBrandingPresentation } from "@/lib/navigation/emailBrandingPresentation";

export function renderEmailTemplateTitle(presentation: EmailBrandingPresentation): string {
  return presentation.title;
}

export function renderEmailTemplateHeaderTitle(presentation: EmailBrandingPresentation): string {
  return presentation.title;
}

/** Email header bar background — organization primary from snapshot. */
export function renderEmailTemplateHeaderBackground(presentation: EmailBrandingPresentation): string {
  return presentation.headerColor;
}

export function renderEmailTemplateHeaderStyle(
  presentation: EmailBrandingPresentation
): Record<string, string> {
  return {
    backgroundColor: presentation.headerColor,
    color: "#ffffff",
  };
}
