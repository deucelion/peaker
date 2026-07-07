import { ensurePdfExtension } from "@/lib/pdf/pdfFilename";

export type PdfDownloadOutcome = "downloaded" | "shared" | "opened" | "cancelled";

export type PdfDownloadMethod = "anchor" | "share";

const REVOKE_DELAY_MS = 60_000;

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isMobileDownloadContext(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return isIOS || isAndroid;
}

export function resolvePdfDownloadMethod(options?: {
  mobile?: boolean;
  standalone?: boolean;
}): PdfDownloadMethod {
  const mobile = options?.mobile ?? isMobileDownloadContext();
  const standalone = options?.standalone ?? isStandalonePwa();
  if (mobile && !standalone) return "share";
  return "anchor";
}

export function pdfDownloadSuccessMessage(outcome: Exclude<PdfDownloadOutcome, "cancelled">): string {
  switch (outcome) {
    case "shared":
      return "Paylaşım menüsünden PDF'i kaydedebilirsiniz.";
    case "opened":
      return "PDF açıldı — kaydetmek için paylaş simgesini kullanın.";
    default:
      return "PDF indirildi.";
  }
}

export function pdfDownloadUserMessage(outcome: PdfDownloadOutcome, downloadedMessage: string): string {
  if (outcome === "cancelled") return "Paylaşım iptal edildi.";
  if (outcome === "downloaded") return downloadedMessage;
  return pdfDownloadSuccessMessage(outcome);
}

function scheduleRevokeObjectURL(url: string): void {
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

function triggerAnchorDownload(url: string, filename: string, preview: boolean): void {
  const a = document.createElement("a");
  a.href = url;
  if (preview) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.download = filename;
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function trySharePdf(blob: Blob, filename: string): Promise<"shared" | "cancelled" | "unsupported"> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unsupported";
  }

  const file = new File([blob], filename, { type: "application/pdf" });
  if (typeof navigator.canShare === "function") {
    try {
      if (!navigator.canShare({ files: [file] })) return "unsupported";
    } catch {
      return "unsupported";
    }
  }

  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

function openPdfPreview(url: string): void {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    triggerAnchorDownload(url, "", true);
  }
}

export async function downloadPdfBytes(bytes: Uint8Array, filename: string): Promise<PdfDownloadOutcome> {
  const safeName = ensurePdfExtension(filename);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });

  if (resolvePdfDownloadMethod() === "share") {
    const shareResult = await trySharePdf(blob, safeName);
    if (shareResult === "shared") return "shared";
    if (shareResult === "cancelled") return "cancelled";

    const url = URL.createObjectURL(blob);
    openPdfPreview(url);
    scheduleRevokeObjectURL(url);
    return "opened";
  }

  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, safeName, false);
  scheduleRevokeObjectURL(url);
  return "downloaded";
}
