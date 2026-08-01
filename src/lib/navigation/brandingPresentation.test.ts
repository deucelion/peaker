import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { resolveFaviconBranding } from "@/lib/organization/branding/surfaces/resolveFaviconBranding";
import { resolveLogoBranding } from "@/lib/organization/branding/surfaces/resolveLogoBranding";
import { resolveMetadataBranding } from "@/lib/organization/branding/surfaces/resolveMetadataBranding";
import { createFaviconBrandingModel } from "./faviconBrandingPresentation";
import { createLogoBrandingModel } from "./logoBrandingModel";
import {
  createMetadataBrandingPresentation,
  METADATA_PAGE_TITLE_SUFFIX,
} from "./metadataBrandingPresentation";

describe("logo metadata favicon branding presentation", () => {
  it("creates logo model from runtime snapshot without binary fields", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      application: { appName: "Atlas Club", shortName: "Atlas" },
      assets: {
        logo: {
          ...createDefaultBranding().assets.logo,
          assetId: "club-logo",
          storagePath: "branding/org-1/logo.svg",
        },
      },
    });

    const metadata = resolveMetadataBranding(branding);
    const logo = createLogoBrandingModel(resolveLogoBranding(branding), metadata.shortName);

    expect(logo.markInitial).toBe("A");
    expect(logo.asset.assetId).toBe("club-logo");
    expect(logo.asset.storagePath).toBe("branding/org-1/logo.svg");
    expect(logo).not.toHaveProperty("binary");
    expect(logo).not.toHaveProperty("base64");
  });

  it("creates metadata presentation for page title manifest and open graph", () => {
    const presentation = createMetadataBrandingPresentation(
      resolveMetadataBranding(
        mergeBranding(createDefaultBranding(), {
          application: { appName: "Atlas Club", shortName: "Atlas" },
        })
      )
    );

    expect(presentation.pageTitle).toBe(`Atlas Club | ${METADATA_PAGE_TITLE_SUFFIX}`);
    expect(presentation.manifestTitle).toBe("Atlas Club");
    expect(presentation.openGraphTitle).toBe("Atlas Club");
  });

  it("creates favicon model as asset reference href only", () => {
    const favicon = createFaviconBrandingModel(
      resolveFaviconBranding(
        mergeBranding(createDefaultBranding(), {
          assets: {
            favicon: {
              ...createDefaultBranding().assets.favicon,
              storagePath: "branding/org-1/favicon.ico",
            },
          },
        })
      )
    );

    expect(favicon.href).toBe("/branding/org-1/favicon.ico");
    expect(favicon.asset.contentType).toBe("image/x-icon");
  });
});
