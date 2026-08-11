import type { MetadataRoute } from "next";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

const defaultTheme = createDefaultBranding().theme;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PEAKER Performance Lab",
    short_name: "PEAKER",
    description: "Elite Athletic Performance & Management",
    start_url: "/",
    display: "standalone",
    background_color: defaultTheme.background,
    theme_color: defaultTheme.background,
    orientation: "portrait-primary",
    lang: "tr",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
