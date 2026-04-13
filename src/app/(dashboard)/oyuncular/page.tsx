"use client";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { Search, UserPlus, ChevronRight, X, Filter, Loader2, UserCircle, UserMinus, UserCheck } from "lucide-react";
import Link from "next/link";
import { addPlayer, deactivateAthlete, reactivateAthlete } from "@/lib/actions/playerActions";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import type { PlayerWithPayments } from "@/types/domain";
import Notification from "@/components/Notification";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

export default function OyuncuYonetimi() {
  const [players, setPlayers] = useState<PlayerWithPayments[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("Tüm Takımlar");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "active" | "inactive">("active");

  useEffect(() => {
    void fetchPlayers();
  }, []);

  // Mevcut takımları dinamik olarak çek (Filtre için)
  const availableTeams = useMemo(() => {
    const teams = new Set(players.map((p) => p.team).filter((team): team is string => typeof team === "string" && team.length > 0));
    return ["Tüm Takımlar", ...Array.from(teams)];
  }, [players]);

  async function fetchPlayers() {
    setLoading(true);
    try {
      const result = await listManagementDirectory();
      if ("error" in result) {
        setPlayers([]);
        return;
      }
      setOrgId(result.organizationId);
      setPlayers((result.athletes as PlayerWithPayments[]) || []);
    } catch (error) {
      console.error("Sporcular yuklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} adli sporcuyu pasife almak istedigine emin misin? Hesap ve gecmis veriler korunur; sporcu panele erisemez.`
      )
    ) {
      return;
    }
    const result = await deactivateAthlete(id);
    if (result?.success) {
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)));
      setActionMessage("Sporcu pasife alindi.");
    } else {
      setActionMessage("Islem hatasi: " + (result?.error || "Bilinmeyen hata"));
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    if (!confirm(`${name} adli sporcuyu tekrar aktif etmek istedigine emin misin?`)) return;
    const result = await reactivateAthlete(id);
    if (result?.success) {
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: true } : p)));
      setActionMessage("Sporcu tekrar aktif edildi.");
    } else {
      setActionMessage("Islem hatasi: " + (result?.error || "Bilinmeyen hata"));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orgId) return;

    setIsSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("organization_id", orgId);
    
    const result = await addPlayer(formData);
    
    if (result?.success) {
      setIsModalOpen(false);
      form.reset();
      void fetchPlayers();
      setActionMessage("Yeni sporcu basariyla eklendi.");
    } else {
      setActionMessage(result?.error || "Kayit sirasinda bir hata olustu.");
    }
    setIsSubmitting(false);
  };

  const filteredPlayers = useMemo(() => {
    const rows = players.filter((player) => {
      const nameMatch = player.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = selectedTeam === "Tüm Takımlar" || player.team === selectedTeam;
      const active = profileRowIsActive(player.is_active);
      const lifecycleOk =
        lifecycleFilter === "all" ||
        (lifecycleFilter === "active" && active) ||
        (lifecycleFilter === "inactive" && !active);
      return nameMatch && matchesTeam && lifecycleOk;
    });
    return [...rows].sort((a, b) => {
      const ac = profileRowIsActive(a.is_active) ? 0 : 1;
      const bc = profileRowIsActive(b.is_active) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (a.full_name || "").localeCompare(b.full_name || "", "tr");
    });
  }, [players, searchTerm, selectedTeam, lifecycleFilter]);

  return (
    <div className="ui-page-loose animate-in fade-in duration-700 min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            TAKIM <span className="text-[#7c3aed]">KADROSU</span>
          </h1>
          <p className="ui-lead break-words">
            Atletik Profil & Kadro Yönetimi
          </p>
        </div>
        <button 
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="ui-btn-primary w-full min-h-12 sm:w-auto sm:min-h-11 px-6 rounded-2xl inline-flex items-center justify-center gap-3 shadow-xl shadow-[#7c3aed]/20 touch-manipulation shrink-0"
        >
          <UserPlus size={20} /> YENİ SPORCU EKLE
        </button>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={actionMessage.toLowerCase().includes("hata") ? "error" : "success"} />
        </div>
      ) : null}

      {/* ARAÇ ÇUBUĞU */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 ui-toolbar shadow-xl min-w-0">
        <div className="relative flex-1 min-w-0 group">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-[#7c3aed] sm:left-6" aria-hidden />
          <input 
            type="search" 
            placeholder="KADRODA ARA..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ui-input pl-12 sm:pl-16 text-base sm:text-[11px] italic uppercase tracking-wide sm:tracking-widest touch-manipulation"
          />
        </div>
        <div className="relative w-full min-w-0 md:min-w-[200px] md:w-auto md:max-w-[280px]">
          <select 
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="ui-select w-full px-6 sm:px-8 text-base sm:text-[11px] italic uppercase appearance-none cursor-pointer pr-12 sm:pr-14 touch-manipulation min-h-11"
          >
            {availableTeams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          <Filter size={16} className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#7c3aed]" aria-hidden />
        </div>
        <div className="relative w-full min-w-0 md:min-w-[200px] md:w-auto md:max-w-[240px]">
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value as "all" | "active" | "inactive")}
            className="ui-select w-full px-6 sm:px-8 text-base sm:text-[11px] italic uppercase appearance-none cursor-pointer pr-12 sm:pr-14 touch-manipulation min-h-11"
          >
            <option value="active">Aktif sporcular</option>
            <option value="inactive">Pasif sporcular</option>
            <option value="all">Tumu</option>
          </select>
          <Filter size={16} className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#7c3aed]" aria-hidden />
        </div>
      </div>

      {/* SPORCU KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {loading ? (
          <div className="col-span-full flex min-h-[35dvh] min-w-0 flex-col items-center justify-center py-20 sm:py-40">
            <Loader2 className="mb-6 animate-spin text-[#7c3aed]" size={48} aria-hidden />
            <p className="animate-pulse text-center text-xs font-black uppercase italic tracking-widest text-gray-500">Kadro Yükleniyor...</p>
          </div>
        ) : filteredPlayers.length > 0 ? (
          filteredPlayers.map(player => (
            <div key={player.id} className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border border-white/5 bg-[#121215] p-5 shadow-xl transition-all sm:rounded-[3rem] sm:p-6 sm:hover:border-[#7c3aed]/40">
              {profileRowIsActive(player.is_active) ? (
                <button
                  type="button"
                  title="Pasife al"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeactivate(player.id, player.full_name || "Sporcu");
                  }}
                  className="absolute top-4 right-4 sm:top-8 sm:right-8 min-h-11 min-w-11 inline-flex items-center justify-center p-0 sm:p-3 bg-amber-500/10 text-amber-400 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all sm:hover:bg-amber-500 sm:hover:text-black z-20 touch-manipulation"
                >
                  <UserMinus size={16} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  title="Tekrar aktif et"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleReactivate(player.id, player.full_name || "Sporcu");
                  }}
                  className="absolute top-4 right-4 sm:top-8 sm:right-8 min-h-11 min-w-11 inline-flex items-center justify-center p-0 sm:p-3 bg-emerald-500/10 text-emerald-400 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all sm:hover:bg-emerald-500 sm:hover:text-black z-20 touch-manipulation"
                >
                  <UserCheck size={16} aria-hidden />
                </button>
              )}

              <div className="flex items-center gap-5 mb-6 min-w-0">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-[#7c3aed]/10 bg-[#1c1c21] font-black text-2xl italic text-[#7c3aed] shadow-inner transition-all sm:group-hover:border-[#7c3aed]">
                   {player.avatar_url ? (
                     <Image
                       src={player.avatar_url}
                       className="w-full h-full object-cover"
                       alt=""
                       width={64}
                       height={64}
                     />
                   ) : (
                     <span className="uppercase">{player.full_name?.[0]}</span>
                   )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tighter leading-tight mb-2 sm:group-hover:text-[#7c3aed] transition-colors break-words pr-12 md:pr-0">
                    {player.full_name}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic flex items-center gap-2 flex-wrap">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${profileRowIsActive(player.is_active) ? "bg-green-500" : "bg-amber-500"}`}
                    />
                    <span className={profileRowIsActive(player.is_active) ? "ui-badge-success !px-2 !py-0.5 !text-[9px] !bg-emerald-500/5 !border-emerald-500/20 text-gray-400" : "ui-badge-warning !px-2 !py-0.5 !text-[9px]"}>
                      {profileRowIsActive(player.is_active) ? "Aktif" : "Pasif"}
                    </span>
                    <span className="text-gray-600">•</span>
                    {player.position || 'GELİŞİM'} • #{player.number || '00'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#1c1c21]/50 p-5 rounded-[2rem] border border-white/5 text-center">
                  <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">BOY / KİLO</p>
                  <p className="text-xs font-black text-gray-300 italic leading-none">{player.height || '0'}cm / {player.weight || '0'}kg</p>
                </div>
                <div className="bg-[#1c1c21]/50 p-5 rounded-[2rem] border border-white/5 text-center">
                  <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">KATEGORİ</p>
                  <p className="text-[9px] font-black text-[#7c3aed] italic uppercase break-words">{player.team || 'GENEL'}</p>
                </div>
              </div>

              <Link href={`/sporcu/${player.id}`} className="mt-auto touch-manipulation">
                <span className="ui-btn-ghost inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl text-[9px] uppercase tracking-[0.2em] shadow-xl sm:min-h-11 sm:tracking-[0.3em] sm:hover:bg-[#7c3aed] sm:hover:text-white">
                  PROFİLİ İNCELE <ChevronRight size={14} aria-hidden />
                </span>
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-[2rem] border-4 border-dashed border-white/5 py-16 text-center sm:rounded-[4rem] sm:py-32">
            <UserCircle size={48} className="mx-auto mb-4 text-gray-800" aria-hidden />
            <p className="text-gray-600 font-black italic uppercase tracking-widest text-xs">Sonuç bulunamadı veya kadro henüz boş.</p>
          </div>
        )}
      </div>

      {/* MODAL (Hafif Görsel İyileştirme ile) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex min-w-0 items-center justify-center overflow-x-hidden overflow-y-auto bg-black/95 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="relative my-auto min-h-0 w-full max-w-lg min-w-0 max-h-[min(92dvh,100%)] overflow-y-auto overscroll-y-contain rounded-[2rem] border border-white/10 bg-[#121215] p-6 shadow-2xl animate-in zoom-in duration-200 sm:rounded-[3.5rem] sm:p-10">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 sm:top-10 sm:right-10 min-h-11 min-w-11 inline-flex items-center justify-center text-gray-600 sm:hover:text-white transition-all touch-manipulation rounded-xl sm:hover:bg-white/5"
              aria-label="Kapat"
            >
              <X size={24} aria-hidden />
            </button>
            <header className="text-center mb-8 sm:mb-10 pr-10">
              <h2 className="text-2xl sm:text-3xl font-black italic text-white uppercase tracking-tighter leading-none mb-3 break-words">
                KADROYA <span className="text-[#7c3aed]">EKLE</span>
              </h2>
              <div className="h-1 w-20 bg-[#7c3aed] mx-auto rounded-full" />
            </header>
            <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-5">
              <input name="fullName" required placeholder="AD SOYAD" autoComplete="name" className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-[#1c1c21] px-5 py-4 text-base font-black uppercase italic text-white outline-none focus:border-[#7c3aed] sm:px-8 sm:py-5 sm:text-[11px]" />
              <input name="email" type="email" required placeholder="E-POSTA ADRESİ" autoComplete="email" className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-[#1c1c21] px-5 py-4 text-base font-black italic text-white outline-none focus:border-[#7c3aed] sm:px-8 sm:py-5 sm:text-[11px]" />
              <input name="password" type="text" required minLength={6} placeholder="GİRİŞ ŞİFRESİ (EN AZ 6)" autoComplete="new-password" className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-[#1c1c21] px-5 py-4 text-base font-black italic text-white outline-none focus:border-[#7c3aed] sm:px-8 sm:py-5 sm:text-[11px]" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select name="position" className="min-h-12 w-full min-w-0 touch-manipulation appearance-none rounded-2xl border border-white/5 bg-[#1c1c21] px-5 py-4 text-base font-black uppercase italic text-white outline-none sm:px-8 sm:py-5 sm:text-[11px]">
                  <option value="PG">PG (1)</option>
                  <option value="SG">SG (2)</option>
                  <option value="SF">SF (3)</option>
                  <option value="PF">PF (4)</option>
                  <option value="C">C (5)</option>
                </select>
                <select name="team" className="min-h-12 w-full min-w-0 touch-manipulation appearance-none rounded-2xl border border-white/5 bg-[#1c1c21] px-5 py-4 text-base font-black uppercase italic text-white outline-none sm:px-8 sm:py-5 sm:text-[11px]">
                  <option value="A TAKIM">A TAKIM</option>
                  <option value="U16 ELITE A">U16 ELITE A</option>
                  <option value="U14 GELİŞİM">U14 GELİŞİM</option>
                </select>
              </div>

              <button type="submit" disabled={isSubmitting} className={`w-full min-h-12 sm:min-h-14 py-4 sm:py-6 rounded-2xl sm:rounded-3xl font-black italic uppercase tracking-[0.25em] sm:tracking-[0.4em] text-white transition-all shadow-2xl mt-2 sm:mt-4 touch-manipulation ${isSubmitting ? 'bg-gray-800' : 'bg-[#7c3aed] sm:hover:shadow-[#7c3aed]/40'}`}>
                {isSubmitting ? "İŞLENİYOR..." : "KAYDI TAMAMLA"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}