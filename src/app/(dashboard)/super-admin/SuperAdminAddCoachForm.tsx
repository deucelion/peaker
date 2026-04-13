"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { addCoach } from "@/lib/actions/coachActions";
import { normalizeEmailInput } from "@/lib/email/emailNormalize";
import Notification from "@/components/Notification";

type Props = {
  organizationId: string;
};

export default function SuperAdminAddCoachForm({ organizationId }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", normalizeEmailInput(email));
    fd.append("password", password);
    fd.append("organizationId", organizationId);
    const result = await addCoach(fd);
    setSubmitting(false);
    if (result && "success" in result && result.success) {
      const extra =
        "alreadyExisted" in result && result.alreadyExisted
          ? " (zaten kayitli koc, liste guncellendi)"
          : "repairedOrphan" in result && result.repairedOrphan
            ? " (eksik profil tamamlandi)"
            : "";
      setMessage(`Koç kaydı tamamlandı.${extra}`);
      setFullName("");
      setEmail("");
      setPassword("");
      router.refresh();
      return;
    }
    setMessage(("error" in result && result.error) || "Koç oluşturulamadı.");
  }

  return (
    <div className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0 overflow-x-hidden">
      <h2 className="text-white text-sm font-black italic uppercase mb-1 break-words">Organizasyona koc ekle</h2>
      <p className="text-[10px] text-gray-500 font-bold uppercase mb-4 break-words">
        Service role ile olusturulur; koc listesi ve izin satiri senkron kalir.
      </p>
      <form
        onSubmit={onSubmit}
        className="grid w-full min-w-0 gap-3 max-w-none sm:max-w-md [&_input]:min-h-11 [&_input]:text-base [&_input]:sm:text-xs"
      >
        <input
          className="w-full min-w-0 bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#7c3aed]/50 touch-manipulation"
          placeholder="Ad Soyad"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
        <input
          type="text"
          inputMode="email"
          className="w-full min-w-0 bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#7c3aed]/50 lowercase touch-manipulation"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(normalizeEmailInput(e.target.value))}
          autoCapitalize="none"
          autoComplete="email"
          required
        />
        <input
          type="password"
          className="w-full min-w-0 bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#7c3aed]/50 touch-manipulation"
          placeholder="Gecici sifre (min 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full sm:w-auto px-4 py-3 rounded-xl bg-[#7c3aed] text-white text-[10px] font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation sm:hover:bg-[#6d28d9]"
        >
          {submitting ? <Loader2 className="animate-spin" size={16} aria-hidden /> : null}
          Koç oluştur
        </button>
      </form>
      {message && (
        <div className="mt-4 min-w-0 break-words">
          <Notification
            message={message}
            variant={message.toLowerCase().includes("tamamlandi") ? "info" : "error"}
          />
        </div>
      )}
      <a
        href={`/koclar?org=${encodeURIComponent(organizationId)}`}
        className="inline-flex min-h-11 items-center mt-4 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation break-all sm:hover:text-[#e9d5ff]"
      >
        Bu org koc listesine git
      </a>
    </div>
  );
}
