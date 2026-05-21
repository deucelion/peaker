"use client";

import { useCallback, useRef, useState } from "react";

export type StreamingExportPhase = "idle" | "running" | "aborted" | "done" | "failed";

export type StreamingExportFeedback = {
  tone: "ok" | "warn" | "err";
  text: string;
} | null;

export type StreamingCsvDownloadResult = {
  ok: boolean;
  rowCount?: number | null;
  truncated?: boolean;
};

/**
 * Faz 15 — Ortak streaming CSV indirme (audit / payments export parity).
 */
export function useStreamingCsvDownload() {
  const [exporting, setExporting] = useState(false);
  const [bytes, setBytes] = useState(0);
  const [phase, setPhase] = useState<StreamingExportPhase>("idle");
  const [feedback, setFeedback] = useState<StreamingExportFeedback>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(
    async (buildUrl: () => string, messages?: {
      success?: (info: { rowCount: number | null; truncated: boolean }) => string;
      rateLimited?: (retrySeconds: number, serverMessage?: string) => string;
      fetchFailed?: string;
      aborted?: string;
    }): Promise<StreamingCsvDownloadResult> => {
      const ac = new AbortController();
      abortRef.current = ac;
      setExporting(true);
      setBytes(0);
      setPhase("running");
      setFeedback(null);
      try {
        const res = await fetch(buildUrl(), { method: "GET", signal: ac.signal, credentials: "include" });
        if (res.status === 429) {
          const j = (await res.json().catch(() => ({}))) as { retryAfterSeconds?: number; error?: string };
          const sec = typeof j.retryAfterSeconds === "number" ? j.retryAfterSeconds : 60;
          setFeedback({
            tone: "warn",
            text:
              messages?.rateLimited?.(sec, j.error) ??
              (j.error ? `${j.error} (${sec}s)` : `Oran sınırı: ${sec} sn sonra tekrar deneyin.`),
          });
          setPhase("failed");
          return { ok: false };
        }
        if (!res.ok) {
          setFeedback({
            tone: "err",
            text: messages?.fetchFailed ?? "Dışa aktarma başarısız. Lütfen tekrar deneyin.",
          });
          setPhase("failed");
          return { ok: false };
        }
        const disp = res.headers.get("Content-Disposition");
        let filename = "export.csv";
        const m = disp?.match(/filename="([^"]+)"/);
        if (m?.[1]) filename = m[1];
        const reader = res.body?.getReader();
        if (!reader) {
          setFeedback({ tone: "err", text: messages?.fetchFailed ?? "Akış okunamadı." });
          setPhase("failed");
          return { ok: false };
        }
        const chunks: BlobPart[] = [];
        let totalBytes = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalBytes += value.byteLength;
            setBytes(totalBytes);
          }
        }
        if (ac.signal.aborted) {
          setPhase("aborted");
          setFeedback({ tone: "warn", text: messages?.aborted ?? "Dışa aktarma iptal edildi." });
          return { ok: false };
        }
        const rowH = res.headers.get("X-Peaker-Row-Count");
        const truncH = res.headers.get("X-Peaker-Truncated");
        const rowCount = rowH != null && rowH !== "" ? Number(rowH) : null;
        const truncated = truncH === "1";
        const blob = new Blob(chunks, { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setPhase("done");
        setFeedback({
          tone: truncated ? "warn" : "ok",
          text:
            messages?.success?.({ rowCount, truncated }) ??
            (truncated && rowCount != null && Number.isFinite(rowCount)
              ? `İlk ${rowCount} satır (cap). Daha dar filtre deneyin.`
              : rowCount != null && Number.isFinite(rowCount)
                ? `${rowCount} kayıt indirildi.`
                : "CSV indirildi."),
        });
        return { ok: true, rowCount, truncated };
      } catch {
        if (ac.signal.aborted) {
          setPhase("aborted");
          setFeedback({ tone: "warn", text: messages?.aborted ?? "Dışa aktarma iptal edildi." });
        } else {
          setPhase("failed");
          setFeedback({ tone: "err", text: messages?.fetchFailed ?? "Dışa aktarma başarısız." });
        }
        return { ok: false };
      } finally {
        setExporting(false);
        abortRef.current = null;
      }
    },
    []
  );

  return { exporting, bytes, phase, feedback, setFeedback, run, cancel };
}
