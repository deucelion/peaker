import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicRoute } from "@/lib/auth/roleMatrix";

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

  if (!isApiRoute && isTransportRequest) {
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
