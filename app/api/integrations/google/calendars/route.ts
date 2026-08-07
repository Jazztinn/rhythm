import { providerAccessToken } from "@/lib/integrations/server";
import { listGoogleCalendars } from "@/lib/integrations/google";
import { NextResponse } from "next/server";

export async function GET() {
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 503 });
  return NextResponse.json(await listGoogleCalendars(token.data));
}
