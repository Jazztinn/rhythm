import { providerAccessToken } from "@/lib/integrations/server";
import { deleteManagedGoogleEvent, updateManagedGoogleEvent } from "@/lib/integrations/google";
import { validateManagedEventId, validateManagedEventPayload, type ManagedEventPayload } from "@/lib/integrations/validation";
import { NextRequest, NextResponse } from "next/server";
import { integrationHttpStatus } from "@/lib/integrations/contracts";

async function body(request: Request) { try { return await request.json() as { calendarId?: string; summary?: string; description?: string; start?: string; end?: string; taskReference?: string }; } catch { return null; } }

export async function PATCH(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const input = await body(request);
  const { eventId } = await context.params;
  const validId = validateManagedEventId(eventId);
  const valid = validateManagedEventPayload(input as ManagedEventPayload | null, "update");
  if (validId.error) return NextResponse.json(validId, { status: 400 });
  if (valid.error) return NextResponse.json(valid, { status: 400 });
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  const validated = valid.data as { calendarId: string; taskReference?: string; summary?: string; description?: string; start?: string; end?: string };
  const { calendarId, ...patch } = validated;
  return NextResponse.json(await updateManagedGoogleEvent(token.data, calendarId, validId.data!, patch));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const input = await body(request);
  const { eventId } = await context.params;
  const validId = validateManagedEventId(eventId);
  const validCalendar = validateManagedEventId(input?.calendarId, "calendar");
  if (validId.error) return NextResponse.json(validId, { status: 400 });
  if (validCalendar.error) return NextResponse.json(validCalendar, { status: 400 });
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  return NextResponse.json(await deleteManagedGoogleEvent(token.data, validCalendar.data!, validId.data!));
}
