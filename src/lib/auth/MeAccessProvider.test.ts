import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { MeAccessProvider, useMeAccess } from "./MeAccessProvider";

function MeAccessProbe() {
  const { payload, ready } = useMeAccess();
  return createElement("span", null, ready && payload?.ok ? "ready" : "pending");
}

describe("MeAccessProvider", () => {
  it("seeds initial server snapshot without requiring fetch", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MeAccessProvider,
        {
          initialMeAccess: {
            role: "admin",
            coachPermissions: null,
            athletePermissions: null,
            organizationFeatures: createClubProfessionalFeatures(),
            featuresRevision: 0,
            organizationBranding: createDefaultBranding(),
            brandingRevision: 0,
          },
          fetchEnabled: false,
        },
        createElement(MeAccessProbe)
      )
    );

    expect(markup).toContain("ready");
  });
});
