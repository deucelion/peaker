export function formatFieldTestPreviousDateLabel(testDate: string): string {
  return new Date(`${testDate}T00:00:00`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
