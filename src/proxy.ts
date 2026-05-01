import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  canAccessRoute,
  getDefaultRouteForRole,
  getSafeRole,
  isPublicRoute,
  ORG_LIFECYCLE_INFO_ROUTE,
} from "@/lib/auth/roleMatrix";
import { isRouteBlockedForCoach, normalizeCoachPermissions } from "@/lib/auth/coachPermissions";
import { isRouteBlockedForAthlete, normalizeAthletePermissions } from "@/lib/auth/athletePermissions";

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

  // Route-level RBAC enforcement (page requests only).
  // API auth remains action-level to avoid breaking existing endpoints.
  if (!isApiRoute) {
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

    const role = getSafeRole(roleFromProfile || user.user_metadata?.role || user.app_metadata?.role);
    const roleInput = role || null;

    if (!canAccessRoute(roleInput, pathname)) {
      if (isTransportRequest) return jsonError(403, "forbidden");
      const fallbackPath = role ? getDefaultRouteForRole(role) : ORG_LIFECYCLE_INFO_ROUTE;
      if (pathname === fallbackPath) return NextResponse.redirect(new URL(ORG_LIFECYCLE_INFO_ROUTE, request.url));
      return NextResponse.redirect(new URL(fallbackPath, request.url));
    }

    if (role === "coach") {
      try {
        const permsRes = await supabase
          .from("coach_permissions")
          .select("can_create_lessons, can_edit_lessons, can_view_all_organization_lessons, can_view_all_athletes, can_add_athletes_to_lessons, can_take_attendance, can_view_reports, can_manage_training_notes, can_manage_athlete_profiles, can_manage_teams")
          .eq("coach_id", user.id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        const permissions = normalizeCoachPermissions((permsRes.data as Record<string, boolean> | null) || undefined);
        if (isRouteBlockedForCoach(pathname, permissions)) {
          if (isTransportRequest) return jsonError(403, "forbidden");
          return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url));
        }
      } catch {
        // Fall back to server action guards on read failure.
      }
    }

    if (role === "sporcu") {
      try {
        const permsRes = await supabase
          .from("athlete_permissions")
          .select("can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar")
          .eq("athlete_id", user.id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        const permissions = normalizeAthletePermissions((permsRes.data as Record<string, boolean> | null) || undefined);
        if (isRouteBlockedForAthlete(pathname, permissions)) {
          if (isTransportRequest) return jsonError(403, "forbidden");
          return NextResponse.redirect(new URL(getDefaultRouteForRole(role), request.url));
        }
      } catch {
        // Fall back to server action guards on read failure.
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
