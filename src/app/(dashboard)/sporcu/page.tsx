"use client";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { 
  Camera,
  Activity,
  CreditCard,
  Moon,
  Loader2,
  Clock,
  Package,
  User,
  ArrowUpRight,
} from "lucide-react";

import { updateAthleteSelfProfile, uploadAthleteAvatar } from "@/lib/actions/athleteSelfProfileActions";
import { listMyBodyMeasurements } from "@/lib/actions/athleteBodyMeasurementActions";
import { getAthletePanelSnapshot } from "@/lib/actions/snapshotActions";
import { listMyAthleteInjuryNotes } from "@/lib/actions/injuryNoteActions";
import { getMyFinanceDetailForAthlete } from "@/lib/actions/financeActions";
import PerformanceRadar from "@/components/PerformanceRadar";
import Notification from "@/components/Notification";
import {
  AthletePageHeader,
  AthleteCard,
  AthleteMetricCard,
  AthleteEmptyState,
} from "@/components/athlete";
import { CompactActionCard, CompactFinanceCard, CompactTimelineItem } from "@/components/compact";
import { AthleteMobileQuickStrip } from "@/components/mobile/AthleteMobileQuickStrip";
import Link from "next/link";
import type { ProfileBasic, PaymentRow } from "@/types/domain";

type AthleteSelfProfile = ProfileBasic & { email?: string | null };
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import type { AthleteInjuryNoteRecord } from "@/lib/types";
import type { FinanceStatusSummary } from "@/lib/types";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";
import { AthleteBodyMeasurementSection } from "@/components/athlete/AthleteBodyMeasurementSection";
import type { AthleteBodyMeasurementRow } from "@/lib/athlete/bodyMeasurement";

export default function SporcuPanel() {
  const [profile, setProfile] = useState<AthleteSelfProfile | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [bodyMeasurements, setBodyMeasurements] = useState<AthleteBodyMeasurementRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(DEFAULT_ATHLETE_PERMISSIONS);
  const [attendancePreview, setAttendancePreview] = useState<
    Array<{ title: string; at: string; status: string }>
  >([]);
  const [injuryNotes, setInjuryNotes] = useState<AthleteInjuryNoteRecord[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceStatusSummary | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getAthletePanelSnapshot();
      if ("error" in snapshot) {
        setProfileMessage(snapshot.error || "Veri alinamadi.");
        return;
      }
      setProfile(snapshot.profile as AthleteSelfProfile);
      setPermissions(snapshot.permissions);
      setPayment((snapshot.payment as PaymentRow | null) || null);
      const bodyRes = await listMyBodyMeasurements();
      if (!("error" in bodyRes)) {
        setBodyMeasurements(bodyRes.measurements);
      }
      setAttendancePreview((snapshot.attendancePreview || []).filter((r) => r.at));
      const injuryRes = await listMyAthleteInjuryNotes();
      if ("error" in injuryRes) {
        setProfileMessage(injuryRes.error || "Sakatlik gecmisi alinamadi.");
      } else {
        setInjuryNotes(injuryRes.notes || []);
      }
      const financeRes = await getMyFinanceDetailForAthlete();
      if (!("error" in financeRes)) {
        setFinanceSummary(financeRes.summary);
      }
    } catch (e) { 
      console.error("Veri çekme hatası:", e); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = event.target.files?.[0];
      if (!file || !profile) return;

      const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
      if (file.size > MAX_AVATAR_BYTES) {
        setProfileMessage("Dosya boyutu 4 MB altinda olmalidir.");
        event.target.value = "";
        return;
      }
      if (!file.type.startsWith("image/")) {
        setProfileMessage("Yalnizca gorsel dosyalari yukleyebilirsiniz.");
        event.target.value = "";
        return;
      }

      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAthleteAvatar(fd);
      if ("error" in result && result.error) {
        setProfileMessage("Yukleme hatasi: " + result.error);
        return;
      }
      if ("publicUrl" in result && result.publicUrl) {
        setProfile({ ...profile, avatar_url: result.publicUrl });
        setProfileMessage("Profil fotografi guncellendi.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Bilinmeyen hata";
      setProfileMessage("Yukleme hatasi: " + message);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaveLoading(true);

    const fd = new FormData();
    fd.append("full_name", profile.full_name ?? "");
    fd.append("height", profile.height != null ? String(profile.height) : "");
    fd.append("weight", profile.weight != null ? String(profile.weight) : "");
    fd.append("position", profile.position ?? "");
    fd.append("number", profile.number ?? "");

    const result = await updateAthleteSelfProfile(fd);
    if ("error" in result && result.error) {
      setProfileMessage(result.error);
    } else {
      setIsEditing(false);
      void fetchData();
      setProfileMessage("Profil basariyla guncellendi.");
    }
    setSaveLoading(false);
  }

  if (loading) return (
    <div className="flex min-h-[60dvh] min-w-0 flex-col items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-white">
      <Loader2 className="mb-8 animate-spin text-[#7c3aed]" size={60} aria-hidden />
      <p className="text-center text-xs font-black uppercase italic tracking-[0.5em] opacity-50">Senkronize Ediliyor...</p>
    </div>
  );

  const financePresentation = getFinanceStatusPresentation(financeSummary);
  if (!permissions.can_view_development_profile) {
    return (
      <div className="min-w-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Notification message="Gelisim profili goruntuleme yetkiniz kapali." variant="info" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-6 animate-in fade-in duration-700 sm:space-y-6 sm:pb-10">
      <AthletePageHeader
        eyebrow="Sporcu paneli"
        title={
          <>
            Gelişim <span className="text-[#7c3aed]">Profilim</span>
          </>
        }
        subtitle="Performans, iyi oluş ve finans özetiniz"
        action={
          <button
            type="button"
            onClick={() => (isEditing ? void handleSave() : setIsEditing(true))}
            className={`min-h-10 w-full touch-manipulation rounded-xl px-5 py-2.5 text-[10px] font-black uppercase italic tracking-[0.15em] transition-all sm:w-auto ${
              isEditing ? "bg-white text-black" : "bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20"
            }`}
          >
            {saveLoading ? (
              <Loader2 className="mx-auto animate-spin" size={16} aria-hidden />
            ) : isEditing ? (
              "Kaydet"
            ) : (
              "Profili düzenle"
            )}
          </button>
        }
      />
      {profileMessage && (
        <Notification message={profileMessage} variant={profileMessage.toLowerCase().includes("hata") ? "error" : "success"} />
      )}

      <AthleteMobileQuickStrip permissions={permissions} />

      <AthleteCard padding="sm">
        <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Bugün Öncelik</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {permissions.can_view_morning_report ? (
            <Link
              href="/sporcu/sabah-raporu"
              className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-4 py-3 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation"
            >
              Önce sabah raporunu gir
            </Link>
          ) : (
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-black uppercase text-gray-600">
              Sabah raporu kapalı
            </span>
          )}
          {permissions.can_view_financial_status ? (
            <Link
              href="/sporcu/finans"
              className={`rounded-xl border px-4 py-3 text-[10px] font-black uppercase touch-manipulation ${financePresentation.badgeClass}`}
            >
              {financePresentation.label}
            </Link>
          ) : (
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-black uppercase text-gray-600">
              Finans görünümü kapalı
            </span>
          )}
          {permissions.can_view_programs ? (
            <Link
              href="/programlarim"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
            >
              Günün programını aç
            </Link>
          ) : (
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-black uppercase text-gray-600">
              Program erişimi kapalı
            </span>
          )}
        </div>
      </AthleteCard>

      {permissions.can_view_development_profile && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AthleteCard padding="sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black italic uppercase text-white tracking-tight">Yoklama özeti</h3>
              <Clock className="text-[#7c3aed]" size={20} />
            </div>
            {attendancePreview.length === 0 ? (
              <AthleteEmptyState
                compact
                title="Henüz yoklama kaydı yok"
                description="İlk dersten sonra katılım özeti burada listelenir."
                action={
                  permissions.can_view_calendar
                    ? { label: "Takvimi aç", href: "/takvim" }
                    : undefined
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {attendancePreview.map((row, i) => (
                  <CompactTimelineItem
                    key={`${row.at}-${i}`}
                    title={row.title}
                    time={
                      row.at
                        ? new Date(row.at).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : undefined
                    }
                    status={row.status}
                    statusTone="purple"
                  />
                ))}
              </ul>
            )}
          </AthleteCard>
          {permissions.can_view_programs ? (
            <CompactActionCard
              href="/programlarim"
              icon={Package}
              eyebrow="Programlar"
              title="Haftalık plan ve notlar"
              hint="Koç notlarını görüntüle"
              tone="neutral"
            />
          ) : null}
        </section>
      )}

      {permissions.can_view_development_profile && (
        <AthleteCard padding="sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black italic uppercase text-white tracking-tight">
              Sakatlık <span className="text-[#7c3aed]">Geçmişi</span>
            </h3>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Sadece görüntüleme</span>
          </div>
          {injuryNotes.length === 0 ? (
            <AthleteEmptyState
              compact
              title="Sakatlık kaydı yok"
              description="Koç veya yönetici not girdikçe geçmiş burada görünür."
              hint="Şu an görüntülenecek kayıt bulunmuyor."
              action={
                permissions.can_view_programs
                  ? { label: "Programlarım", href: "/programlarim" }
                  : permissions.can_view_calendar
                    ? { label: "Takvim", href: "/takvim" }
                    : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {injuryNotes.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-black uppercase text-white break-words">{item.injuryType}</p>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">
                      {new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-gray-300">{item.note}</p>
                  {item.assets.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {item.assets.map((asset) => (
                        <a
                          key={asset.path}
                          href={asset.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                        >
                          <Image
                            src={asset.signedUrl}
                            alt={item.injuryType}
                            width={240}
                            height={160}
                            unoptimized
                            className="h-20 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </AthleteCard>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {permissions.can_view_morning_report ? (
          <CompactActionCard
            href="/sporcu/sabah-raporu"
            icon={Moon}
            eyebrow="Hazırlık durumu"
            title="Sabah raporu gir"
            hint="İyi oluş verisi antrenör paneline yansır"
            tone="purple"
          />
        ) : null}
        {permissions.can_view_rpe_entry ? (
          <CompactActionCard
            href="/anket"
            icon={Activity}
            eyebrow="Antrenman yükü"
            title="RPE raporu gir"
            hint="Dünkü idman zorluğunu kaydet"
            tone="neutral"
          />
        ) : null}
        {permissions.can_view_financial_status ? (
          <CompactFinanceCard
            href="/sporcu/finans"
            icon={CreditCard}
            label="Finansal durum"
            statusLabel={financePresentation.label}
            amount={financeSummary?.nextAmount ?? payment?.amount ?? null}
            dueLabel={financeSummary?.nextDueDate || payment?.due_date || undefined}
            supportText={financePresentation.supportText}
            tone={
              financePresentation.tone === "green"
                ? "green"
                : financePresentation.tone === "yellow"
                  ? "yellow"
                  : financePresentation.tone === "orange"
                    ? "orange"
                    : "rose"
            }
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <AthleteCard className="relative flex flex-col items-center overflow-hidden shadow-lg" padding="sm">
            <div className="group relative mb-4">
              <div className="mx-auto h-24 w-24 rounded-2xl border-4 border-[#7c3aed]/10 p-0.5 sm:h-28 sm:w-28">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border-2 border-[#7c3aed]/20 bg-black">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      className="h-full w-full object-cover"
                      alt={profile.full_name || "Sporcu"}
                      width={112}
                      height={112}
                    />
                  ) : (
                    <User size={40} className="text-[#7c3aed]/20" />
                  )}
                </div>
              </div>
              <input type="file" id="avatarInput" hidden onChange={handleAvatarUpload} />
              <button
                type="button"
                onClick={() => document.getElementById("avatarInput")?.click()}
                className="absolute -bottom-1 -right-1 min-h-10 min-w-10 touch-manipulation rounded-xl border-2 border-[#121215] bg-[#7c3aed] p-2 text-white shadow-lg"
                aria-label="Profil fotoğrafı yükle"
              >
                <Camera size={16} aria-hidden />
              </button>
            </div>
            <h2 className="max-w-full break-words px-2 text-center text-lg font-black uppercase italic tracking-tight text-white sm:text-xl">
              {profile?.full_name || "Sporcu"}
            </h2>
            {profile?.email ? (
              <p className="mt-1 max-w-full truncate px-3 text-center text-[10px] font-bold text-gray-500" title={profile.email}>
                {profile.email}
              </p>
            ) : null}
            <div className="mb-4 mt-3 flex items-center gap-2">
              <span className="rounded-full border border-[#7c3aed]/20 bg-[#7c3aed]/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#7c3aed]">
                {profile?.position?.trim() || "Sporcu"}
              </span>
              <span className="font-black italic text-gray-600">#{profile?.number || "—"}</span>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 border-t border-white/5 pt-4">
              <AthleteMetricCard
                label="Boy"
                value={profile?.height}
                unit="cm"
                isEditing={isEditing}
                onChange={(v) =>
                  setProfile(profile ? { ...profile, height: Number(v) || null } : profile)
                }
              />
              <AthleteMetricCard
                label="Kilo"
                value={profile?.weight}
                unit="kg"
                isEditing={isEditing}
                onChange={(v) =>
                  setProfile(profile ? { ...profile, weight: Number(v) || null } : profile)
                }
              />
            </div>
            {isEditing && profile && (
              <div className="grid grid-cols-1 gap-3 w-full pt-4">
                <input
                  value={profile.full_name ?? ""}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Ad Soyad"
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                />
                <div className="grid min-w-0 grid-cols-2 gap-3">
                  <input
                    value={profile.position ?? ""}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                    placeholder="Pozisyon"
                    className="min-h-11 min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                  />
                  <input
                    value={profile.number ?? ""}
                    onChange={(e) => setProfile({ ...profile, number: e.target.value })}
                    placeholder="Numara"
                    className="min-h-11 min-w-0 touch-manipulation rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[#7c3aed] sm:text-sm"
                  />
                </div>
              </div>
            )}
          </AthleteCard>
        </aside>

        <main className="space-y-5 lg:col-span-8">
          {permissions.can_view_skill_radar && (
          <AthleteCard className="group shadow-lg" padding="sm">
             <div className="mb-3 flex min-w-0 items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="shrink-0 rounded-xl bg-[#7c3aed]/10 p-2 text-[#7c3aed]"><Activity size={18} aria-hidden /></div>
                  <h3 className="break-words text-sm font-black uppercase italic tracking-tight text-white">Beceri <span className="text-[#7c3aed]">radarı</span></h3>
                </div>
                <ArrowUpRight className="shrink-0 text-gray-700 sm:group-hover:text-[#7c3aed]" size={20} aria-hidden />
             </div>
             <PerformanceRadar />
          </AthleteCard>
          )}

          {permissions.can_view_development_profile && (
            <AthleteBodyMeasurementSection
              mode="self"
              canRecord
              measurements={bodyMeasurements}
              currentHeight={profile?.height}
              currentWeight={profile?.weight}
              onRecorded={() => void fetchData()}
            />
          )}

        </main>
      </div>
    </div>
  );
}