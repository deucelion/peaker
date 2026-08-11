import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/actions/organizationBrandingActions", () => ({
  loadOrganizationBrandingEditorSnapshot: vi.fn(),
  saveOrganizationBrandingAction: vi.fn(),
}));

import OrgBrandingEditor from "@/app/(dashboard)/super-admin/_components/OrgBrandingEditor";

describe("OrgBrandingEditor", () => {
  it("renders theme controls and preview for super-admin editor", () => {
    const markup = renderToStaticMarkup(
      createElement(OrgBrandingEditor, {
        initialSnapshot: {
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Test Org",
          branding: createDefaultBranding(),
          brandingRevision: 2,
        },
      })
    );

    expect(markup).toContain("Organizasyon Branding");
    expect(markup).toContain("Content Theme");
    expect(markup).toContain("Sidebar Theme");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Revision: 2");
  });
});
