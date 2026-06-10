/** Form / server action: sifreyi oldugu gibi al (trim yok — harfler korunur). */
export function readPasswordInput(value: string | null | undefined): string {
  return value ?? "";
}

export function validatePasswordMinLength(password: string, min = 6): string | null {
  if (!password || password.length < min) {
    return `Şifre en az ${min} karakter olmalıdır.`;
  }
  return null;
}

/** Supabase createUser / signIn sifre hatalarini Turkce mesaja cevir. */
export function mapAuthPasswordError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("weak") || lower.includes("easy to guess") || lower.includes("pwned")) {
    return "Şifre çok zayıf veya yaygın kullanılıyor. Farklı bir şifre deneyin.";
  }
  if (lower.includes("at least") && lower.includes("character")) {
    return "Şifre en az 6 karakter olmalıdır.";
  }
  return message;
}

/** Sifre alanlari: buyuk harf gorunumu harfli sifrelerde giris uyumsuzluguna yol acar. */
export const PASSWORD_FIELD_PROPS = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;
