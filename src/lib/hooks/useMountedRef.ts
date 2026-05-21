"use client";

import { useEffect, useRef } from "react";

/** Faz 16 — Unmount sonrası setState koruması. */
export function useMountedRef() {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}
