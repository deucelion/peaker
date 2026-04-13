import { normalizeEmailInput } from "@/lib/email/emailNormalize";

export type DisplayNameProfile = {
  full_name?: string | null;
  email?: string | null;
};

/** Tek giriş noktası: profil satırı veya parça alanlar. */
export function getDisplayName(profile: DisplayNameProfile | null | undefined, fallback = "Kullanici"): string {
  return toDisplayName(profile?.full_name, profile?.email, fallback);
}

export function toDisplayName(
  fullName: string | null | undefined,
  email?: string | null,
  fallback = "Kullanici"
): string {
  const raw = (fullName || "").trim();
  if (raw && !raw.includes("@")) return raw;

  const sourceEmail = normalizeEmailInput(email || raw);
  if (!sourceEmail || !sourceEmail.includes("@")) return raw || fallback;

  const local = sourceEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return fallback;
  return local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
