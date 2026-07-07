import { redirect } from "next/navigation";
import { PATHS } from "@/lib/navigation/routeRegistry";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Eski bookmark'lar Tahsilat Merkezi'ne yönlendirilir. */
export default async function MuhasebeFinansRedirectPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const q = new URLSearchParams();
  q.set("bolum", "tahsilatlar");
  const org = sp.org;
  if (typeof org === "string" && org.trim()) q.set("org", org.trim());
  redirect(`${PATHS.tahsilatMerkezi}?${q.toString()}`);
}
