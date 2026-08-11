export function resolveAthleteFieldTestSelectedNames(
  allNames: readonly string[],
  userSelection: readonly string[] | null
): string[] {
  if (allNames.length === 0) return [];
  const valid = (userSelection ?? []).filter((name) => allNames.includes(name));
  if (valid.length > 0) return [...valid];
  return [...allNames];
}

export function resolveAthleteFieldTestDateRange(
  results: ReadonlyArray<{ test_date: string }>,
  rangeFrom: string,
  rangeTo: string
): { from: string; to: string } {
  if (rangeFrom || rangeTo) {
    return { from: rangeFrom, to: rangeTo };
  }
  if (results.length === 0) {
    return { from: "", to: "" };
  }
  const days = results
    .map((row) => row.test_date.split("T")[0] ?? "")
    .filter(Boolean)
    .sort();
  if (days.length === 0) {
    return { from: "", to: "" };
  }
  return { from: days[0]!, to: days[days.length - 1]! };
}
