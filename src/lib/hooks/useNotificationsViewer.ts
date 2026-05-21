"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listMyNotificationsSnapshot } from "@/lib/actions/snapshotActions";
import type { AppNotification } from "@/lib/types";

/**
 * Faz 7.1 — Bildirimler page viewer hook'u.
 *
 * - İlk yükleme + "Daha fazla yükle" pagination'ı yönetir.
 * - Optimistik mark-as-read için items setter exposure'ı sağlar.
 * - Davranışsal değişiklik yok; page'deki lifecycle birebir.
 */

export const NOTIFICATIONS_PAGE_SIZE = 50;

function mapNotificationRow(raw: Record<string, unknown>): AppNotification {
  return {
    id: String(raw.id ?? ""),
    userId: String(raw.user_id ?? ""),
    message: String(raw.message ?? ""),
    read: Boolean(raw.read),
    createdAt:
      typeof raw.created_at === "string"
        ? raw.created_at
        : raw.created_at instanceof Date
          ? raw.created_at.toISOString()
          : new Date().toISOString(),
  };
}

export function useNotificationsViewer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snapshot = await listMyNotificationsSnapshot(1, NOTIFICATIONS_PAGE_SIZE);
    if ("error" in snapshot) {
      setError(snapshot.error || "Bildirimler alinamadi.");
      setLoading(false);
      return;
    }
    setItems(snapshot.items || []);
    setTotal(snapshot.total || 0);
    setPage(1);
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const snapshot = await listMyNotificationsSnapshot(nextPage, NOTIFICATIONS_PAGE_SIZE);
    if ("error" in snapshot) {
      setError(snapshot.error || "Bildirimler alinamadi.");
      setLoadingMore(false);
      return;
    }
    setItems((prev) => [...prev, ...(snapshot.items || [])]);
    setTotal(snapshot.total || 0);
    setPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, page]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    const channelRef: { current: ReturnType<typeof supabase.channel> | null } = { current: null };

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      if (!uid) return;

      const channel = supabase
        .channel(`notifications-page-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const next = mapNotificationRow(row);
            setItems((prev) => {
              if (prev.some((p) => p.id === next.id)) return prev;
              return [next, ...prev];
            });
            setTotal((t) => t + 1);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const next = mapNotificationRow(row);
            setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          }
        )
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
    };
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return {
    loading,
    error,
    items,
    total,
    page,
    loadingMore,
    unreadCount,
    refetch: fetchData,
    loadMore,
    setItems,
  };
}
