import { clearProviderSession } from "@/lib/integrations/session";
import { success } from "@/lib/integrations/contracts";
import { NextResponse } from "next/server";

export async function DELETE() {
  await clearProviderSession("slack");
  return NextResponse.json(success({ disconnected: true }, "not_connected"));
}
