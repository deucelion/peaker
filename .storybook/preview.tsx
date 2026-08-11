import type { Preview } from "@storybook/react";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { BrandingUiProvider } from "@/lib/ui/branding/BrandingUiProvider";
import "../src/app/(dashboard)/globals.css";

export type BrandingStoryVariant = "default" | "custom";

export const BRANDING_STORY_VARIANTS: BrandingStoryVariant[] = ["default", "custom"];

export function resolveBrandingStoryVariant(variant: BrandingStoryVariant = "default") {
  if (variant === "custom") {
    return mergeBranding(createDefaultBranding(), {
      brandingRevision: 3,
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
        accent: "#112233",
      },
    });
  }
  return createDefaultBranding();
}

export const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  globalTypes: {
    brandingVariant: {
      description: "Organization branding variant",
      defaultValue: "default",
      toolbar: {
        title: "Branding",
        icon: "paintbrush",
        items: [
          { value: "default", title: "Default org" },
          { value: "custom", title: "Custom org" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const variant = (context.globals.brandingVariant ?? "default") as BrandingStoryVariant;
      const organizationBranding = resolveBrandingStoryVariant(variant);

      return (
        <BrandingUiProvider organizationBranding={organizationBranding}>
          <div
            className="min-h-[240px] p-6"
      style={{
        backgroundColor: "var(--peaker-ui-BACKGROUND)",
        color: "var(--peaker-ui-TEXT_PRIMARY)",
      }}
          >
            <Story />
          </div>
        </BrandingUiProvider>
      );
    },
  ],
};

export default preview;
