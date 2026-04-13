import { NextResponse } from "next/server";
import { buildMeRolePayload } from "@/lib/auth/meRolePayload";

export async function GET() {
  const result = await buildMeRolePayload();
  if (!result.ok) {
    const body: Record<string, string> = { error: result.error };
    if (result.gateStatus) body.organizationStatus = result.gateStatus;
    return NextResponse.json(body, { status: result.httpStatus });
  }
  return NextResponse.json({
    role: result.role,
    fullName: result.fullName,
    organizationId: result.organizationId,
    organizationName: result.organizationName,
    userId: result.userId,
    email: result.email,
  });
}
