export function hasPair(email: string | undefined, password: string | undefined): boolean {
  return Boolean(email?.trim() && password?.trim());
}
