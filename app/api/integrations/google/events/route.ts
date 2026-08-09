import { providerAccessToken } from "@/lib/integrations/server";
import { listGoogleEvents } from "@/lib/integrations/google";
import { NextRequest, NextResponse } from "next/server";
import { validateVisibleCalendarRange } from "@/lib/integrations/calendar-context";
import { integrationHttpStatus } from "@/lib/integrations/contracts";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const range = validateVisibleCalendarRange(url.searchParams.get("start"), url.searchParams.get("end"));
  if (range.error) return NextResponse.json(range, { status: 400 });
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  const calendarIds = (url.searchParams.get("calendars") ?? "primary").split(",").filter(Boolean).slice(0, 10);
  return NextResponse.json(await listGoogleEvents(token.data, calendarIds, range.data!.start, range.data!.end));
}
