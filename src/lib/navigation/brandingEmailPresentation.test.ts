import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { resolveEmailBranding } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import {
  renderEmailTemplateHeaderTitle,
  renderEmailTemplateTitle,
} from "@/lib/email/emailTemplateBranding";
import {
  createDefaultEmailBrandingPresentation,
  createEmailBrandingPresentation,
  createEmailBrandingPresentationFromOrganizationBranding,
} from "./emailBrandingPresentation";
import {
  createDefaultOrganizationBrandingPresentation,
  createOrganizationBrandingPresentation,
} from "./organizationBrandingPresentation";

describe("emailBrandingPresentation", () => {
  it("creates email title presentation from snapshot", () => {
    const presentation = createEmailBrandingPresentation(
      resolveEmailBranding(
        mergeBranding(createDefaultBranding(), {
          email: { title: "Atlas Club" },
        })
      )
    );

    expect(presentation).toEqual({ title: "Atlas Club" });
    expect(Object.keys(presentation)).toEqual(["title"]);
  });

  it("falls back to default email title presentation", () => {
    expect(createDefaultEmailBrandingPresentation().title).toBe("PEAKER");
  });

  it("creates email presentation from organizationBranding snapshot", () => {
    const presentation = createEmailBrandingPresentationFromOrganizationBranding(createDefaultBranding());
    expect(presentation.title).toBe("PEAKER");
  });
});

describe("email template branding", () => {
  it("renders email template title from presentation", () => {
    const presentation = createEmailBrandingPresentation(
      resolveEmailBranding(
        mergeBranding(createDefaultBranding(), {
          email: { title: "Atlas Club Mail" },
        })
      )
    );

    expect(renderEmailTemplateTitle(presentation)).toBe("Atlas Club Mail");
    expect(renderEmailTemplateHeaderTitle(presentation)).toBe("Atlas Club Mail");
  });
});

describe("organizationBrandingPresentation email bundle", () => {
  it("includes email presentation in organization branding bundle", () => {
    const bundle = createOrganizationBrandingPresentation(createDefaultBranding());
    expect(bundle.email.title).toBe("PEAKER");
  });

  it("includes runtime email title in organization branding bundle", () => {
    const bundle = createOrganizationBrandingPresentation(
      mergeBranding(createDefaultBranding(), {
        email: { title: "Custom Email" },
      })
    );
    expect(bundle.email.title).toBe("Custom Email");
  });

  it("preserves default bundle parity for email title", () => {
    expect(createDefaultOrganizationBrandingPresentation().email).toEqual(createDefaultEmailBrandingPresentation());
  });
});
