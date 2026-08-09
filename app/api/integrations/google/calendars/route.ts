import { providerAccessToken } from "@/lib/integrations/server";
import { listGoogleCalendars } from "@/lib/integrations/google";
import { NextResponse } from "next/server";
import { integrationHttpStatus } from "@/lib/integrations/contracts";

export async function GET() {
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  return NextResponse.json(await listGoogleCalendars(token.data));
}
