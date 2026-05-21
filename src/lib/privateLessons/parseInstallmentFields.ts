export type InstallmentFields = {
  installmentCount: number | null;
  installmentIntervalDays: number | null;
  nextPaymentDueAt: string | null;
};

export function parseInstallmentFieldsFromForm(formData: FormData): InstallmentFields | { error: string } {
  const countRaw = formData.get("installmentCount")?.toString().trim() || "";
  const intervalRaw = formData.get("installmentIntervalDays")?.toString().trim() || "";
  const dueRaw = formData.get("nextPaymentDueAt")?.toString().trim() || "";

  let installmentCount: number | null = null;
  let installmentIntervalDays: number | null = null;
  let nextPaymentDueAt: string | null = null;

  if (countRaw) {
    const n = Math.floor(Number(countRaw));
    if (!Number.isFinite(n) || n <= 0) return { error: "Taksit sayısı pozitif tamsayı olmalıdır." };
    installmentCount = n;
  }
  if (intervalRaw) {
    const n = Math.floor(Number(intervalRaw));
    if (!Number.isFinite(n) || n <= 0) return { error: "Taksit aralığı (gün) pozitif tamsayı olmalıdır." };
    installmentIntervalDays = n;
  }
  if (dueRaw) {
    const d = new Date(dueRaw);
    if (!Number.isFinite(d.getTime())) return { error: "Sonraki ödeme tarihi geçersiz." };
    nextPaymentDueAt = d.toISOString();
  }

  return { installmentCount, installmentIntervalDays, nextPaymentDueAt };
}
