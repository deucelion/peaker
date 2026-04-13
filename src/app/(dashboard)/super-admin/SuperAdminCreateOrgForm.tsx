"use client";

import { useState } from "react";
import { createOrganizationWithAdmin } from "@/lib/actions/superAdminActions";
import Notification from "@/components/Notification";

export default function SuperAdminCreateOrgForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    organizationName: "",
    adminFullName: "",
    adminEmail: "",
    tempPassword: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("organizationName", form.organizationName);
    fd.append("adminFullName", form.adminFullName);
    fd.append("adminEmail", form.adminEmail);
    fd.append("tempPassword", form.tempPassword);
    const result = await createOrganizationWithAdmin(fd);
    if (result?.success) {
      setMessage("Organizasyon ve admin hesabi olusturuldu.");
      setForm({ organizationName: "", adminFullName: "", adminEmail: "", tempPassword: "" });
    } else {
      setMessage(result?.error || "Organizasyon olusturma basarisiz.");
    }
    setSubmitting(false);
  }

  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 min-w-0">
      <p className="text-white text-sm font-black italic uppercase mb-4 break-words">Yeni Organizasyon Oluştur</p>
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 min-w-0 [&_input]:min-h-11 [&_input]:text-base [&_input]:sm:text-xs"
      >
        <input
          required
          value={form.organizationName}
          onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))}
          placeholder="ORGANIZASYON ADI"
          className="w-full min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white font-bold italic outline-none"
        />
        <input
          value={form.adminFullName}
          onChange={(e) => setForm((prev) => ({ ...prev, adminFullName: e.target.value }))}
          placeholder="ADMIN AD SOYAD (OPS.)"
          className="w-full min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white font-bold italic outline-none"
        />
        <input
          required
          type="email"
          autoComplete="email"
          value={form.adminEmail}
          onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
          placeholder="ADMIN EMAIL"
          className="w-full min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white font-bold italic outline-none"
        />
        <input
          required
          minLength={6}
          autoComplete="new-password"
          value={form.tempPassword}
          onChange={(e) => setForm((prev) => ({ ...prev, tempPassword: e.target.value }))}
          placeholder="GECICI SIFRE (MIN 6)"
          className="w-full min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-white font-bold italic outline-none"
        />
        <button
          disabled={submitting}
          type="submit"
          className="min-h-11 touch-manipulation bg-[#7c3aed] sm:hover:bg-[#6d28d9] disabled:opacity-60 text-white rounded-xl py-3 text-[10px] font-black uppercase"
        >
          {submitting ? "OLUSTURULUYOR..." : "ORGANIZASYON OLUSTUR"}
        </button>
      </form>
      {message && (
        <Notification
          message={message}
          className="mt-3"
          variant={message.toLowerCase().includes("basarisiz") || message.toLowerCase().includes("hata") ? "error" : "success"}
        />
      )}
    </section>
  );
}
