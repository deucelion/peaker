"use client";

import { useEffect } from "react";
import type { FaviconBrandingModel } from "@/lib/navigation/faviconBrandingPresentation";
import type { MetadataBrandingPresentation } from "@/lib/navigation/metadataBrandingPresentation";

const BRANDING_FAVICON_LINK_SELECTOR = 'link[data-branding-favicon="true"]';
const BRANDING_APPLICATION_NAME_SELECTOR = 'meta[data-branding-application-name="true"]';
const BRANDING_OPEN_GRAPH_TITLE_SELECTOR = 'meta[data-branding-open-graph-title="true"]';
const BRANDING_MANIFEST_TITLE_SELECTOR = 'meta[data-branding-manifest-title="true"]';

function upsertMetaTag(selector: string, attributes: Record<string, string>): void {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== "content") {
        element?.setAttribute(key, value);
      }
    });
    document.head.appendChild(element);
  }

  if (attributes.content) {
    element.setAttribute("content", attributes.content);
  }
}

function upsertFaviconLink(favicon: FaviconBrandingModel): void {
  let element = document.head.querySelector(BRANDING_FAVICON_LINK_SELECTOR);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "icon");
    element.setAttribute("data-branding-favicon", "true");
    document.head.appendChild(element);
  }

  element.setAttribute("href", favicon.href);
  element.setAttribute("type", favicon.asset.contentType);
}

export function BrandingDocumentMetadata({
  metadata,
  favicon,
}: {
  metadata: MetadataBrandingPresentation;
  favicon: FaviconBrandingModel;
}) {
  useEffect(() => {
    document.title = metadata.pageTitle;

    upsertMetaTag(BRANDING_APPLICATION_NAME_SELECTOR, {
      name: "application-name",
      "data-branding-application-name": "true",
      content: metadata.manifestTitle,
    });

    upsertMetaTag(BRANDING_MANIFEST_TITLE_SELECTOR, {
      name: "apple-mobile-web-app-title",
      "data-branding-manifest-title": "true",
      content: metadata.manifestTitle,
    });

    upsertMetaTag(BRANDING_OPEN_GRAPH_TITLE_SELECTOR, {
      property: "og:title",
      "data-branding-open-graph-title": "true",
      content: metadata.openGraphTitle,
    });

    upsertFaviconLink(favicon);
  }, [metadata, favicon]);

  return null;
}
