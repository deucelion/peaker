/** Bilgilendirme metni — engellemez, yalnızca onay diyaloğu için. */
export function privateLessonSlotOverlapWarningMessage(existingPeerCount: number): string | null {
  const n = Math.floor(existingPeerCount);
  if (n <= 0) return null;
  const suffix = n === 1 ? "1 özel dersi daha" : `${n} özel dersi daha`;
  return `⚠️ Bu zaman diliminde aynı koçun ${suffix} bulunuyor.\n\nDevam etmek istiyor musunuz?`;
}

export type PrivateLessonSlotOverlapPeer = {
  id: string;
  athleteName: string | null;
  packageName: string | null;
  startsAt: string;
  endsAt: string;
};
