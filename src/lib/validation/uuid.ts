/**
 * RFC 4122 UUID (case-insensitive hex). Server action’lardaki `assertUuid` ile aynı sözleşme.
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_REGEX.test(value);
}
