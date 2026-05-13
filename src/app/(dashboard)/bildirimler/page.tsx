"use client";

import { useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { LoadMoreButton } from "@/components/ui/data-display";
import { markAllNotificationsReadForCurrentUser, markNotificationRead } from "@/lib/actions/lessonActions";
import { useNotificationsViewer } from "@/lib/hooks/useNotificationsViewer";
import { NotificationPreferencesPanel } from "./_components/NotificationPreferencesPanel";

export default function NotificationsPage() {
  const {
    loading,
    error,
    items,
    total,
    loadingMore,
    unreadCount,
    loadMore,
    setItems,
  } = useNotificationsViewer();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleMarkRead(id: string) {
    const result = await markNotificationRead(id);
    if (result?.success) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || bulkBusy) return;
    setBulkBusy(true);
    setFeedback(null);
    const result = await markAllNotificationsReadForCurrentUser();
    if (result && "error" in result) {
      setFeedback(typeof result.error === "string" ? result.error : "Bildirimler güncellenemedi.");
    } else if (result?.success) {
      setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
      setFeedback(`${result.updatedCount} bildirim okundu işaretlendi.`);
      window.setTimeout(() => setFeedback(null), 3500);
    }
    setBulkBusy(false);
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
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          BILDIRIM <span className="text-[#7c3aed]">MERKEZI</span>
        </h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]">
              {unreadCount} okunmamış
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0 || bulkBusy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#7c3aed]/40 hover:text-white touch-manipulation"
            aria-label="Tüm bildirimleri okundu işaretle"
          >
            {bulkBusy ? (
              <Loader2 className="size-3.5 animate-spin text-[#7c3aed]" aria-hidden />
            ) : (
              <CheckCheck className="size-3.5 text-[#7c3aed]" aria-hidden />
            )}
            Hepsini okundu işaretle
          </button>
        </div>
      </header>

      {error && <Notification message={error} variant="error" />}
      {feedback && <Notification message={feedback} variant="success" />}

      <NotificationPreferencesPanel />

      {!error && items.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Bildirim bulunmuyor."
          description="Yeni bir aktivite olduğunda burada görünür."
          variant="no_data"
        />
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
          <LoadMoreButton
            loaded={items.length}
            total={total}
            loading={loadingMore}
            onClick={() => void loadMore()}
          />
        </div>
      )}
    </div>
  );
}
