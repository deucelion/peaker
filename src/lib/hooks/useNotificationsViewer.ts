"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
