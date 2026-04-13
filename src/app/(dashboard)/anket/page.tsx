"use client";
import { useState, useEffect, useMemo } from "react";
import { 
  Zap, 
  Clock, 
  Smile, 
  Frown, 
  Meh, 
  AlertCircle, 
  CheckCircle2,
  TrendingUp,
  History,
  ClipboardList,
  CalendarDays
} from "lucide-react";
import Notification from "@/components/Notification";
import { getRpeSurveyEligibility, submitAthleteTrainingLoadSurvey } from "@/lib/actions/trainingLoadSurveyActions";

function toLocalDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RPEAnketi() {
  const [duration, setDuration] = useState<number>(90);
  const [rpe, setRpe] = useState<number>(5);
  const [selectedSession, setSelectedSession] = useState<string>("Antrenman");
  const [sessionDate, setSessionDate] = useState(() => toLocalDateInput(new Date()));
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  const maxDateStr = useMemo(() => toLocalDateInput(new Date()), []);
  const minDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalDateInput(d);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await getRpeSurveyEligibility();
      setIsAllowed(res.allowed);
    })();
  }, []);

  if (isAllowed === false) {
    return (
      <div className="min-w-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] overflow-x-hidden break-words">
        <Notification message="RPE giriş ekranı sizin için kapalı." variant="info" />
      </div>
    );
  }

  // RPE Skoruna göre renk ve metin belirleme (TypeScript için val: number eklendi)
  const getRpeLabel = (val: number) => {
    if (val <= 2) return { label: "ÇOK KOLAY", color: "text-blue-400", icon: <Smile /> };
    if (val <= 4) return { label: "KOLAY / ORTA", color: "text-green-400", icon: <Smile /> };
    if (val <= 6) return { label: "ZORLAYICI", color: "text-yellow-500", icon: <Meh /> };
    if (val <= 8) return { label: "ÇOK ZOR", color: "text-orange-500", icon: <Frown /> };
    return { label: "MAKSİMAL / TÜKENİŞ", color: "text-red-500", icon: <AlertCircle /> };
  };

  const handleSubmit = async () => {
    setLoading(true);
    setSubmitError(null);

    if (sessionDate < minDateStr || sessionDate > maxDateStr) {
      setSubmitError("Tarih geçerli aralıkta değil (en fazla 30 gün geriye).");
      setLoading(false);
      return;
    }

    const result = await submitAthleteTrainingLoadSurvey({
      sessionDate,
      durationMinutes: duration,
      rpeScore: rpe,
      sessionType: selectedSession,
    });

    if ("error" in result && result.error) {
      setSubmitError(result.error);
      setLoading(false);
      return;
    }

    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
    setLoading(false);
  };

  return (
    <div className="max-w-xl md:max-w-2xl mx-auto w-full min-w-0 px-3 sm:px-6 space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] overflow-x-hidden">
      <header className="text-center space-y-3 sm:space-y-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#7c3aed]/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto border border-[#7c3aed]/20">
          <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-[#7c3aed]" aria-hidden />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">İDMAN <span className="text-[#7c3aed]">RAPORU</span></h1>
        <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] italic px-2 break-words">Gelişimin için idman verilerini sisteme işle</p>
      </header>

      {isSubmitted ? (
        <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[2.5rem] text-center space-y-4 animate-in zoom-in duration-300">
          <CheckCircle2 size={64} className="mx-auto text-green-500" aria-hidden />
          <h2 className="text-2xl font-black italic text-white uppercase">RAPOR ALINDI!</h2>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Verilerin analiz motoruna gönderildi.</p>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          
          <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] shadow-xl">
            <span className="flex items-center gap-2 text-gray-500 font-black text-[9px] sm:text-[10px] uppercase tracking-widest mb-4 italic">
              <CalendarDays className="w-4 h-4 text-[#7c3aed] shrink-0" aria-hidden /> ANTRENMAN TARİHİ
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="date"
                value={sessionDate}
                min={minDateStr}
                max={maxDateStr}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full min-h-11 sm:max-w-[14rem] bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-base sm:text-sm font-bold text-white outline-none focus:border-[#7c3aed]/50 [color-scheme:dark] touch-manipulation"
              />
              <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wide italic leading-relaxed">
                Varsayılan bugün. Aynı güne ikinci kayıt önceki kaydı günceller.
              </p>
            </div>
          </div>

          {/* 1. ÇALIŞMA TÜRÜ SEÇİCİ */}
          <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] shadow-xl">
            <span className="flex items-center gap-2 text-gray-500 font-black text-[10px] uppercase tracking-widest mb-6 italic">
              <ClipboardList size={16} className="text-[#7c3aed]" aria-hidden /> 1. ÇALIŞMA TÜRÜ
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {["Antrenman", "Maç", "Fitness", "Bireysel"].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSelectedSession(type)}
                  className={`min-h-11 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black italic text-[9px] sm:text-[10px] uppercase transition-all border touch-manipulation ${
                    selectedSession === type 
                    ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20 sm:scale-[1.02]' 
                    : 'bg-[#1c1c21] border-white/5 text-gray-500 sm:hover:bg-white/5'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 2. SÜRE SEÇİCİ */}
          <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] shadow-xl">
            <div className="flex items-center justify-between mb-5 sm:mb-8">
              <span className="flex items-center gap-2 text-gray-500 font-black text-[9px] sm:text-[10px] uppercase tracking-widest italic">
                <Clock className="w-4 h-4 text-[#7c3aed] shrink-0" aria-hidden /> 2. İDMAN SÜRESİ
              </span>
              <span className="text-xl sm:text-2xl font-black italic text-white tabular-nums">{duration} <span className="text-[10px] sm:text-xs not-italic text-gray-600 uppercase">dk</span></span>
            </div>
            <input 
              type="range" min="15" max="180" step="5" value={duration} 
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-3 sm:h-2 bg-[#1c1c21] rounded-lg appearance-none cursor-pointer accent-[#7c3aed] touch-manipulation py-1"
            />
          </div>

          {/* 3. RPE SEÇİCİ (ZORLUK) */}
          <div className="bg-[#121215] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-[2rem] shadow-xl">
            <div className="text-center mb-5 sm:mb-8">
              <span className="text-gray-500 font-black text-[9px] sm:text-[10px] uppercase tracking-widest block mb-3 sm:mb-4 italic">3. ZORLUK SEVİYESİ (RPE)</span>
              <div className={`text-4xl sm:text-5xl font-black italic mb-2 ${getRpeLabel(rpe).color}`}>{rpe}</div>
              <div className={`text-xs font-black uppercase tracking-[0.2em] italic opacity-80 ${getRpeLabel(rpe).color}`}>
                {getRpeLabel(rpe).label}
              </div>
            </div>
            
            <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5 sm:gap-2 mb-5 sm:mb-8">
              {[1,2,3,4,5,6,7,8,9,10].map((val) => (
                <button 
                  type="button"
                  key={val}
                  onClick={() => setRpe(val)}
                  className={`min-h-11 h-10 sm:h-12 rounded-lg sm:rounded-xl text-sm sm:text-base font-black italic transition-all touch-manipulation ${
                    rpe === val ? 'bg-[#7c3aed] text-white sm:scale-110 shadow-lg shadow-[#7c3aed]/30' : 'bg-[#1c1c21] text-gray-600 sm:hover:bg-white/5'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 flex items-start gap-3 sm:gap-4">
              <div className={`mt-1 shrink-0 ${getRpeLabel(rpe).color}`} aria-hidden>{getRpeLabel(rpe).icon}</div>
              <p className="text-[10px] font-bold text-gray-500 italic leading-relaxed uppercase break-words">
                BU PUANLAMA, ANTRENMANIN KALP HIZI VE KAS YORGUNLUĞU ÜZERİNDEKİ GENEL ETKİSİNİ TEMSİL EDER. LÜTFEN DÜRÜST OLUN.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-12 w-full bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white py-3.5 sm:py-4 rounded-xl sm:rounded-[2rem] text-sm sm:text-base font-black italic uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all shadow-xl shadow-[#7c3aed]/30 flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 active:scale-[0.99] touch-manipulation"
          >
            {loading ? "GÖNDERİLİYOR..." : <><TrendingUp size={20} aria-hidden /> ANALİZİ TAMAMLA</>}
          </button>
          {submitError && (
            <div className="min-w-0 break-words">
              <Notification message={submitError} variant="error" />
            </div>
          )}
        </div>
      )}

      {/* GEÇMİŞ ÖZETİ */}
      <div className="flex items-center justify-center gap-2 text-gray-600 font-bold text-[10px] uppercase tracking-widest pt-4 italic">
        <History size={14} aria-hidden /> SON 7 GÜNLÜK İDMAN YÜKÜN HESAPLANIYOR...
      </div>
    </div>
  );
}