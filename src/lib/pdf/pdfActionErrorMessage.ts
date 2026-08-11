export function firstPdfActionErrorMessage(
  responses: ReadonlyArray<{ error?: string | null } | Record<string, unknown>>
): string | null {
  for (const response of responses) {
    if ("error" in response && typeof response.error === "string" && response.error.trim()) {
      return response.error;
    }
  }
  return null;
}

export function pdfTaskErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
