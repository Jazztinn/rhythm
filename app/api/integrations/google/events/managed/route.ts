import { providerAccessToken } from "@/lib/integrations/server";
import { createManagedGoogleEvent } from "@/lib/integrations/google";
import { validateManagedEventPayload, type ManagedEventPayload, type ValidManagedEvent } from "@/lib/integrations/validation";
import { NextRequest, NextResponse } from "next/server";
import { integrationHttpStatus } from "@/lib/integrations/contracts";

export async function POST(request: NextRequest) {
  let input: { calendarId?: string; taskReference?: string; summary?: string; description?: string; start?: string; end?: string } | null = null;
  try { input = await request.json(); } catch { /* normalized below */ }
  const valid = validateManagedEventPayload(input as ManagedEventPayload | null, "create");
  if (valid.error) return NextResponse.json(valid, { status: 400 });
  const token = await providerAccessToken("google");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  return NextResponse.json(await createManagedGoogleEvent(token.data, valid.data as ValidManagedEvent));
}
