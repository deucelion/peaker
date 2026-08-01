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
  isRouteBlockedForCoach,
} from "@/lib/auth/coachPermissions";
import {
  isRouteBlockedForAthlete,
} from "@/lib/auth/athletePermissions";
import {
  loadAthletePermissionsForProxy,
  loadCoachPermissionsForProxy,
} from "@/lib/auth/proxyPermissionReads";
import { evaluateProxyRouteFeatureAccess } from "@/lib/auth/proxyRouteFeatureAccess";

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
      const permissions = await loadCoachPermissionsForProxy(user.id, organizationId);
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
      const permissions = await loadAthletePermissionsForProxy(user.id, organizationId);
      if (isRouteBlockedForAthlete(pathname, permissions)) {
        const athleteFallback = getDefaultRouteForRole(role);
        const safeAthleteTarget = safeRedirectPath(pathname, athleteFallback);
        if (!safeAthleteTarget) {
          if (isTransportRequest) return jsonError(403, "forbidden");
          return response;
        }
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

    const featureDecision = await evaluateProxyRouteFeatureAccess(pathname, organizationId);
    if (featureDecision === "deny") {
      if (isTransportRequest) return jsonError(403, "forbidden");
      const featureFallback = role ? getDefaultRouteForRole(role) : fallbackRouteForDeniedAccess(role);
      const safeFeatureTarget = safeRedirectPath(pathname, featureFallback);
      if (!safeFeatureTarget) return response;
      logRouteRedirectDecision("proxy", {
        pathname,
        role,
        organizationId,
        target: safeFeatureTarget,
        reason: "feature_entitlement_denied",
      });
      return NextResponse.redirect(new URL(safeFeatureTarget, request.url));
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
