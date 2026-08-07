import { providerAccessToken } from "@/lib/integrations/server";
import { deleteManagedGoogleEvent, updateManagedGoogleEvent } from "@/lib/integrations/google";
import { NextRequest, NextResponse } from "next/server";

async function body(request: Request) { try { return await request.json() as { calendarId?: string; summary?: string; description?: string; start?: string; end?: string; taskReference?: string }; } catch { return null; } }

export async function PATCH(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const token = await providerAccessToken("google");
  const input = await body(request);
  const { eventId } = await context.params;
  if (!token.data || !input?.calendarId) return NextResponse.json(token.data ? { status: "provider_unavailable", data: null, error: { code: "provider_unavailable", message: "Calendar and event details are required.", retryable: false } } : token, { status: 400 });
  return NextResponse.json(await updateManagedGoogleEvent(token.data, input.calendarId, eventId, input));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const token = await providerAccessToken("google");
  const input = await body(request);
  const { eventId } = await context.params;
  if (!token.data || !input?.calendarId) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 400 });
  return NextResponse.json(await deleteManagedGoogleEvent(token.data, input.calendarId, eventId));
}
