import { providerAccessToken } from "@/lib/integrations/server";
import { createManagedGoogleEvent } from "@/lib/integrations/google";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = await providerAccessToken("google");
  let input: { calendarId?: string; taskReference?: string; summary?: string; description?: string; start?: string; end?: string } | null = null;
  try { input = await request.json(); } catch { /* normalized below */ }
  if (!token.data) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 503 });
  if (!input?.calendarId || !input.taskReference || !input.summary || !input.start || !input.end) return NextResponse.json({ status: "provider_unavailable", data: null, error: { code: "provider_unavailable", message: "Calendar, task, title, start, and end are required.", retryable: false } }, { status: 400 });
  return NextResponse.json(await createManagedGoogleEvent(token.data, { calendarId: input.calendarId, taskReference: input.taskReference, summary: input.summary, description: input.description, start: input.start, end: input.end }));
}
