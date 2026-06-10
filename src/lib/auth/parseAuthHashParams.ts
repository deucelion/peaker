/** URL hash içindeki auth token parametrelerini okur (sunucu tarafında erişilemez). */
export function parseAuthHashParams(hash: string): URLSearchParams | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return null;
  return new URLSearchParams(trimmed);
}
