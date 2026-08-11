import { tableSelectors } from "@/lib/ui/branding/tableSelectors";

/** Resolve a content-theme CSS color to a canvas/SVG-safe computed value in the browser. */
function resolveThemeColor(anchor: HTMLElement, cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = cssColor;
  anchor.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return resolved || getComputedStyle(anchor).backgroundColor;
}

/** Recharts SVG'sini PNG data URL'e cevirir (performans PDF icin). */
export async function captureSvgChartPng(
  container: HTMLElement | null,
  width = 640,
  height = 280
): Promise<string | null> {
  if (!container) return null;
  const svg = container.querySelector("svg");
  if (!svg) return null;

  const surfaceFill = resolveThemeColor(container, tableSelectors.surface);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", surfaceFill);
  clone.insertBefore(bg, clone.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG render failed"));
      el.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = surfaceFill;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
