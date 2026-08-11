import { NextResponse } from "next/server";
import { resolveMeAccessApiPayloadWithRequestCache } from "@/lib/auth/meAccessBootstrap";

export async function GET() {
  const result = await resolveMeAccessApiPayloadWithRequestCache();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }

  return NextResponse.json(result);
}
