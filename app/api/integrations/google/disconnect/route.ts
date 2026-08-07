import { clearProviderSession } from "@/lib/integrations/session";
import { NextResponse } from "next/server";
import { success } from "@/lib/integrations/contracts";

export async function DELETE() {
  await clearProviderSession("google");
  return NextResponse.json(success({ disconnected: true }, "not_connected"));
}
