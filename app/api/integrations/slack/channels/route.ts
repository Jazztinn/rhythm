import { providerAccessToken } from "@/lib/integrations/server";
import { listSlackChannels } from "@/lib/integrations/slack";
import { NextRequest, NextResponse } from "next/server";
import { integrationHttpStatus } from "@/lib/integrations/contracts";

export async function GET(request: NextRequest) {
  const token = await providerAccessToken("slack");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  return NextResponse.json(await listSlackChannels(token.data, request.nextUrl.searchParams.get("cursor") ?? ""));
}
