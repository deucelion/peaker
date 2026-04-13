"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { markNotificationRead } from "@/lib/actions/lessonActions";
import { listMyNotificationsSnapshot } from "@/lib/actions/snapshotActions";
import type { AppNotification } from "@/lib/types";

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snapshot = await listMyNotificationsSnapshot(1, 100);
    if ("error" in snapshot) {
      setError(snapshot.error || "Bildirimler alinamadi.");
      setLoading(false);
      return;
    }
    setItems(snapshot.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  async function handleMarkRead(id: string) {
    const result = await markNotificationRead(id);
    if (result?.success) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-wide text-gray-500 sm:tracking-widest">Bildirimler yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          BILDIRIM <span className="text-[#7c3aed]">MERKEZI</span>
        </h1>
      </header>

      {error && <Notification message={error} variant="error" />}

      {!error && items.length === 0 && (
        <div className="p-10 sm:p-16 text-center bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] min-w-0">
          <Bell size={40} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">Bildirim bulunmuyor.</p>
        </div>
      )}

      {!error && items.length > 0 && (
        <div className="grid gap-3 min-w-0">
          {items.map((item) => (
            <div key={item.id} className={`bg-[#121215] border rounded-[1.5rem] p-4 min-w-0 ${item.read ? "border-white/5" : "border-[#7c3aed]/30"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-black italic break-words">{item.message}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic mt-1 break-words">{new Date(item.createdAt).toLocaleString("tr-TR")}</p>
                </div>
                {!item.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id)}
                    className="min-h-11 w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white text-[10px] font-black uppercase touch-manipulation"
                  >
                    Okundu
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
