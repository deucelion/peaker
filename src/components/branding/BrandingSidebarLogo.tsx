import type { LogoBrandingModel } from "@/lib/navigation/logoBrandingModel";
import type { MetadataBrandingPresentation } from "@/lib/navigation/metadataBrandingPresentation";
import { SIDEBAR_THEME_VARS } from "@/lib/navigation/sidebarThemeTokens";

export function BrandingSidebarLogo({
  logo,
  metadata,
  organizationName,
}: {
  logo: LogoBrandingModel;
  metadata: MetadataBrandingPresentation;
  organizationName: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-6 mb-4">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-black italic text-white shadow-lg"
        style={{
          backgroundColor: SIDEBAR_THEME_VARS.PRIMARY,
          boxShadow: `0 10px 15px -3px color-mix(in srgb, ${SIDEBAR_THEME_VARS.PRIMARY} 20%, transparent)`,
        }}
        data-asset-id={logo.asset.assetId}
        data-storage-path={logo.asset.storagePath}
        data-content-type={logo.asset.contentType}
        data-updated-at={logo.asset.updatedAt}
        aria-label={logo.accessibilityLabel}
      >
        {logo.markInitial}
      </div>
      <div className="flex flex-col" style={{ color: SIDEBAR_THEME_VARS.TEXT_PRIMARY }}>
        <span className="text-xl font-black tracking-tighter italic leading-none">
          {organizationName}
          <span style={{ color: SIDEBAR_THEME_VARS.PRIMARY }}>.</span>
        </span>
        <span
          className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.2em]"
          style={{ color: SIDEBAR_THEME_VARS.TEXT_SECONDARY }}
        >
          Powered by {metadata.shortName}
        </span>
      </div>
    </div>
  );
}
