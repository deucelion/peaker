"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MeAccessApiPayload } from "@/lib/auth/meAccessBootstrap";
import {
  fetchMeAccessClient,
  resetMeAccessClientCache,
  seedMeAccessClientCache,
  toMeAccessClientPayload,
  type MeAccessClientPayload,
} from "@/lib/auth/meAccessClient";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import type { CoachPermissions, AthletePermissions } from "@/lib/types";

export type MeAccessContextValue = {
  readonly payload: MeAccessClientPayload | null;
  readonly ready: boolean;
  readonly refresh: (options?: { force?: boolean }) => Promise<MeAccessClientPayload>;
};

export const MeAccessContext = createContext<MeAccessContextValue | null>(null);

export type MeAccessProviderProps = {
  readonly children: ReactNode;
  readonly initialMeAccess?: MeAccessApiPayload | null;
  readonly fetchEnabled?: boolean;
};

export function MeAccessProvider({
  children,
  initialMeAccess = null,
  fetchEnabled = false,
}: MeAccessProviderProps) {
  const [payload, setPayload] = useState<MeAccessClientPayload | null>(() =>
    initialMeAccess ? toMeAccessClientPayload(initialMeAccess) : null
  );
  const [ready, setReady] = useState(Boolean(initialMeAccess));
  const fetchedRef = useRef(Boolean(initialMeAccess));

  useEffect(() => {
    if (initialMeAccess) {
      seedMeAccessClientCache(toMeAccessClientPayload(initialMeAccess));
    }
  }, [initialMeAccess]);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const next = await fetchMeAccessClient(options);
    setPayload(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    if (!fetchEnabled || fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;
    if (initialMeAccess && payload?.ok) {
      setReady(true);
      return;
    }

    void refresh();
  }, [fetchEnabled, initialMeAccess, payload?.ok, refresh]);

  const value = useMemo<MeAccessContextValue>(
    () => ({
      payload,
      ready,
      refresh,
    }),
    [payload, ready, refresh]
  );

  return <MeAccessContext.Provider value={value}>{children}</MeAccessContext.Provider>;
}

export function useMeAccess(): MeAccessContextValue {
  const value = useContext(MeAccessContext);
  if (value === null) {
    throw new Error("useMeAccess must be used within MeAccessProvider");
  }
  return value;
}

export function useMeAccessOrganizationFeatures(): OrganizationFeatures | null {
  const { payload, ready } = useMeAccess();
  if (!ready || !payload?.ok) {
    return null;
  }
  return payload.organizationFeatures;
}

export function useMeAccessOrganizationBranding(): OrganizationBranding | null {
  const { payload, ready } = useMeAccess();
  if (!ready || !payload?.ok) {
    return null;
  }
  return payload.organizationBranding;
}

export function useMeAccessCoachPermissions(): CoachPermissions | null {
  const { payload, ready } = useMeAccess();
  if (!ready || !payload?.ok) {
    return null;
  }
  return payload.coachPermissions;
}

export function useMeAccessAthletePermissions(): AthletePermissions | null {
  const { payload, ready } = useMeAccess();
  if (!ready || !payload?.ok) {
    return null;
  }
  return payload.athletePermissions;
}

export function invalidateMeAccessSession(): void {
  resetMeAccessClientCache();
}
