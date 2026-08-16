import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recomputeEffectiveFeatures } from "@/lib/organization/features/recompute";
import type { FeatureOverrides, FeaturePresetId } from "@/lib/organization/features/types";
import type { OrganizationFeatureEditorSnapshot } from "@/lib/actions/organizationFeatureActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/actions/organizationFeatureActions", () => ({
  loadOrganizationFeatureEditorSnapshot: vi.fn(),
  saveOrganizationFeaturePresetAction: vi.fn(),
}));

import OrgPackageEditor from "@/app/(dashboard)/super-admin/_components/OrgPackageEditor";

function createSnapshot(
  preset: FeaturePresetId,
  overrides: FeatureOverrides = {}
): OrganizationFeatureEditorSnapshot {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    organizationName: "Test Org",
    featurePreset: preset,
    featureOverrides: overrides,
    features: recomputeEffectiveFeatures({ preset, overrides }),
    featuresRevision: 4,
  };
}

function render(snapshot: OrganizationFeatureEditorSnapshot, runtimeEnabled = false) {
  return renderToStaticMarkup(
    createElement(OrgPackageEditor, { initialSnapshot: snapshot, runtimeEnabled })
  );
}

describe("OrgPackageEditor preset selector", () => {
  it("renders every supported preset with the active one marked", () => {
    const markup = render(createSnapshot("club_professional"));

    expect(markup).toContain("Organizasyon Paketi");
    expect(markup).toContain("Academy Lite");
    expect(markup).toContain("Academy Plus");
    expect(markup).toContain("Club Professional");
    expect(markup).toContain("Club Enterprise");
    expect(markup).toContain("Özel Paket");
    expect(markup).toContain("AKTIF");
    expect(markup).toContain("Revision: 4");
  });

  it("reports a saved state with the save button disabled when nothing changed", () => {
    const markup = render(createSnapshot("academy_plus"));

    expect(markup).toContain("Kaydedildi");
    expect(markup).not.toContain("Kaydedilmemiş değişiklikler");
    expect(markup).toMatch(/Kaydet<\/button>/);
    expect(markup).toContain("disabled=\"\"");
  });

  it("warns that runtime entitlements are inactive while the switch is off", () => {
    const markup = render(createSnapshot("academy_lite"), false);

    expect(markup).toContain("Platform feature switch kapali");
  });

  it("omits the runtime warning when the switch is on", () => {
    const markup = render(createSnapshot("academy_lite"), true);

    expect(markup).not.toContain("Platform feature switch kapali");
  });
});

describe("OrgPackageEditor custom entitlement section", () => {
  it("is hidden while a named preset is selected", () => {
    const markup = render(createSnapshot("club_professional"));

    expect(markup).not.toContain("Özel Paket Özellikleri");
  });

  it("is shown when the saved preset is custom", () => {
    const markup = render(createSnapshot("custom", { finance: true }));

    expect(markup).toContain("Özel Paket Özellikleri");
    expect(markup).toContain("Bu organizasyona özel modül seçimi");
  });

  it("renders a labelled control and description for every configurable entitlement", () => {
    const markup = render(createSnapshot("custom", { finance: true }));

    expect(markup).toContain("Özel ders");
    expect(markup).toContain("Finans");
    expect(markup).toContain("Bildirimler");
    expect(markup).toContain("Audit");
    expect(markup).toContain("Saha testleri");
    expect(markup).toContain("Vücut ölçümleri");
    expect(markup).toContain("Tahsilat merkezi, muhasebe, ödemeler ve koç hakedişleri.");
  });

  it("groups the insight children under their bundle parent", () => {
    const markup = render(createSnapshot("custom"));

    expect(markup).toContain("Performans &amp; Raporlama");
    expect(markup).toContain("6 alt modül");
  });

  it("does not expose raw entitlement keys as user-facing labels", () => {
    const markup = render(createSnapshot("custom", { finance: true }));

    expect(markup).not.toContain(">insight.field_tests<");
    expect(markup).not.toContain(">private_lessons<");
  });

  it("reflects the saved override state in the checked controls", () => {
    const enabled = render(createSnapshot("custom", { finance: true }));
    const disabled = render(createSnapshot("custom", { finance: false }));

    expect(enabled).toContain("checked=\"\"");
    expect(enabled).not.toBe(disabled);
  });
});

describe("OrgPackageEditor custom to named preset warning", () => {
  it("warns that custom overrides will be removed only when leaving custom", () => {
    const stayingCustom = render(createSnapshot("custom", { finance: true }));

    expect(stayingCustom).not.toContain("özel override");
  });
});

describe("OrgPackageEditor drift detection", () => {
  it("surfaces unsaved changes when a named preset carries leftover overrides", () => {
    // A named preset is normally stored with empty overrides. If direct SQL or a
    // pre-Phase-37 write left overrides behind, the materialized features no longer
    // match the template and saving would normalize the organization.
    const drifted = createSnapshot("academy_lite", { finance: true });

    expect(drifted.features.finance).toBe(true);

    const markup = render(drifted);

    expect(markup).toContain("Kaydedilmemiş değişiklikler");
    expect(markup).not.toContain("Kaydedildi<");
  });

  it("reports no pending change for a clean named preset", () => {
    const markup = render(createSnapshot("academy_lite"));

    expect(markup).toContain("Kaydedildi");
    expect(markup).not.toContain("Kaydedilmemiş değişiklikler");
  });
});
