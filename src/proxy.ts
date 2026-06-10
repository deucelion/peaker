import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessRoute, getDefaultRouteForRole, isPublicRoute } from "@/lib/auth/roleMatrix";
import { resolveRouteRoleFromUser } from "@/lib/auth/resolveRouteRole";
import {
  fallbackRouteForDeniedAccess,
  logRouteRedirectDecision,
  safeRedirectPath,
} from "@/lib/auth/routeRedirect";
import {
  denyAllCoachPermissions,
  isRouteBlockedForCoach,
  normalizeCoachPermissions,
} from "@/lib/auth/coachPermissions";
import {
  denyAllAthletePermissions,
  isRouteBlockedForAthlete,
  normalizeAthletePermissions,
} from "@/lib/auth/athletePermissions";

/**
 * Yalnızca oturum (cookie + Supabase session) kontrolü.
 * Rol ve org çözümü `/api/me-role` + server action’larda (`resolveSessionActor` vb.).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const accept = request.headers.get("accept") || "";
  const isActionRequest = request.headers.has("next-action") || request.headers.has("x-action");
  const isRscRequest =
    request.headers.get("rsc") === "1" ||
    request.nextUrl.searchParams.has("_rsc") ||
    accept.includes("text/x-component");
  const isTransportRequest = isActionRequest || isRscRequest;
  const jsonError = (status: number, error: string) =>
    new NextResponse(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isMeRoleApiRoute = pathname === "/api/me-role";

  if (isPublicRoute(pathname)) {
    return response;
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    if (isApiRoute || isTransportRequest) {
      return jsonError(401, "unauthorized");
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    const search = request.nextUrl.search;
    if (search) loginUrl.searchParams.set("prev", search);
    return NextResponse.redirect(loginUrl);
  }

  if (isMeRoleApiRoute) {
    return response;
  }

  // Route-level RBAC: sayfa navigasyonu + RSC. Server action auth action guard'larda kalır.
  if (!isApiRoute && !isActionRequest) {
    let roleFromProfile: string | null = null;
    let organizationId: string | null = null;
    try {
      const profileRes = await supabase
        .from("profiles")
        .select("role, organization_id")
        .eq("id", user.id)
        .maybeSingle();
      roleFromProfile = typeof profileRes.data?.role === "string" ? profileRes.data.role : null;
      organizationId = typeof profileRes.data?.organization_id === "string" ? profileRes.data.organization_id : null;
    } catch {
      roleFromProfile = null;
      organizationId = null;
    }

    const role = resolveRouteRoleFromUser(user, roleFromProfile);
    const roleInput = role || null;

    if (!canAccessRoute(roleInput, pathname)) {
      if (isTransportRequest) return jsonError(403, "forbidden");

      const isSuperAdminOnlyPath =
        pathname === "/super-admin" ||
        pathname.startsWith("/super-admin/") ||
        pathname === "/sistem-saglik";

      // Edge middleware'de role null olabilir (RLS/cookie senkronu). Super-admin sayfa guard'i
      // server-side daha güçlü actor çözümü yaptığı için bu yolları guard'a bırakıp loop'u kesiyoruz.
      if (!role && isSuperAdminOnlyPath) {
        logRouteRedirectDecision("proxy", {
          pathname,
          role,
          organizationId,
          target: null,
          reason: "same_path_guard",
        });
        return response;
      }

      const fallbackPath = fallbackRouteForDeniedAccess(role);
      const safeTarget = safeRedirectPath(pathname, fallbackPath);
      if (!safeTarget) {
        logRouteRedirectDecision("proxy", {
          pathname,
          role,
          organizationId,
          target: null,
          reason: "same_path_guard",
        });
        return response;
      }
      logRouteRedirectDecision("proxy", {
        pathname,
        role,
        organizationId,
        target: safeTarget,
        reason: "forbidden_route",
      });
      return NextResponse.redirect(new URL(safeTarget, request.url));
    }

    if (role === "coach") {
      // FAZ 29: izin okuması başarısız olursa fail-closed — izin gerektiren
      // rotalar reddedilir, serbest rotalar etkilenmez.
      let permissions = denyAllCoachPermissions();
      try {
        const permsRes = await supabase
          .from("coach_permissions")
          .select("can_create_lessons, can_edit_lessons, can_view_all_organization_lessons, can_view_all_athletes, can_add_athletes_to_lessons, can_take_attendance, can_view_reports, can_manage_training_notes, can_manage_athlete_profiles, can_manage_teams")
          .eq("coach_id", user.id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!permsRes.error) {
          permissions = normalizeCoachPermissions((permsRes.data as Record<string, boolean> | null) || undefined);
        }
      } catch {
        // fail-closed: deny-all izin seti ile devam
      }
      if (isRouteBlockedForCoach(pathname, permissions)) {
        if (isTransportRequest) return jsonError(403, "forbidden");
        const coachFallback = getDefaultRouteForRole(role);
        const safeCoachTarget = safeRedirectPath(pathname, coachFallback);
        if (!safeCoachTarget) return response;
        logRouteRedirectDecision("proxy", {
          pathname,
          role,
          organizationId,
          target: safeCoachTarget,
          reason: "coach_permission_denied",
        });
        return NextResponse.redirect(new URL(safeCoachTarget, request.url));
      }
    }

    if (role === "sporcu") {
      // FAZ 29: izin okuması başarısız olursa fail-closed.
      let permissions = denyAllAthletePermissions();
      try {
        const permsRes = await supabase
          .from("athlete_permissions")
          .select("can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar")
          .eq("athlete_id", user.id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!permsRes.error) {
          permissions = normalizeAthletePermissions((permsRes.data as Record<string, boolean> | null) || undefined);
        }
      } catch {
        // fail-closed: deny-all izin seti ile devam
      }
      if (isRouteBlockedForAthlete(pathname, permissions)) {
        if (isTransportRequest) return jsonError(403, "forbidden");
        const athleteFallback = getDefaultRouteForRole(role);
        const safeAthleteTarget = safeRedirectPath(pathname, athleteFallback);
        if (!safeAthleteTarget) return response;
        logRouteRedirectDecision("proxy", {
          pathname,
          role,
          organizationId,
          target: safeAthleteTarget,
          reason: "athlete_permission_denied",
        });
        return NextResponse.redirect(new URL(safeAthleteTarget, request.url));
      }
    }
  }

  if (!isApiRoute && isTransportRequest) {
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
