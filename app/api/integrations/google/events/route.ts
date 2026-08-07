import { providerAccessToken } from "@/lib/integrations/server";
import { listGoogleEvents } from "@/lib/integrations/google";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 503 });
  const url = request.nextUrl;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ status: "provider_unavailable", data: null, error: { code: "provider_unavailable", message: "A visible date range is required.", retryable: false } }, { status: 400 });
  const calendarIds = (url.searchParams.get("calendars") ?? "primary").split(",").filter(Boolean).slice(0, 20);
  return NextResponse.json(await listGoogleEvents(token.data, calendarIds, start, end));
}
