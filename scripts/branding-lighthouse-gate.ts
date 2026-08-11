/**
 * FAZ 34 Wave 14 — Lighthouse gate (blocking when LIGHTHOUSE_URL is set).
 */
import { execSync } from "node:child_process";

const LIGHTHOUSE_URL = process.env.LIGHTHOUSE_URL?.trim();
const LIGHTHOUSE_THRESHOLDS = {
  lcpMs: 2205,
  cls: 0.05,
};

export function runLighthouseGate(): { ok: true; skipped?: false } | { ok: true; skipped: true } | { ok: false; message: string } {
  if (!LIGHTHOUSE_URL) {
    console.log("SKIP: LIGHTHOUSE_URL unset — Lighthouse gate deferred to staging CI.");
    return { ok: true, skipped: true };
  }

  try {
    const output = execSync(
      `npx lighthouse ${JSON.stringify(LIGHTHOUSE_URL)} --quiet --chrome-flags="--headless --no-sandbox" --output=json --only-categories=performance`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const report = JSON.parse(output) as {
      audits?: Record<string, { numericValue?: number; numericUnit?: string }>;
    };
    const lcp = report.audits?.["largest-contentful-paint"]?.numericValue ?? Infinity;
    const cls = report.audits?.["cumulative-layout-shift"]?.numericValue ?? Infinity;

    if (lcp > LIGHTHOUSE_THRESHOLDS.lcpMs) {
      return { ok: false, message: `LCP ${lcp}ms exceeds ${LIGHTHOUSE_THRESHOLDS.lcpMs}ms threshold.` };
    }
    if (cls > LIGHTHOUSE_THRESHOLDS.cls) {
      return { ok: false, message: `CLS ${cls} exceeds ${LIGHTHOUSE_THRESHOLDS.cls} threshold.` };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Lighthouse gate failed: ${message}` };
  }
}
