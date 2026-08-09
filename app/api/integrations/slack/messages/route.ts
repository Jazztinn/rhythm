import { providerAccessToken } from "@/lib/integrations/server";
import { listSlackMessages } from "@/lib/integrations/slack";
import { NextRequest, NextResponse } from "next/server";
import { integrationHttpStatus, requestFailure } from "@/lib/integrations/contracts";

export async function GET(request: NextRequest) {
  const token = await providerAccessToken("slack");
  const channelId = request.nextUrl.searchParams.get("channel");
  if (!token.data) return NextResponse.json(token, { status: integrationHttpStatus(token.status) });
  if (!channelId) return NextResponse.json(requestFailure("invalid_request", "Choose a public channel first."), { status: 400 });
  return NextResponse.json(await listSlackMessages(token.data, channelId, request.nextUrl.searchParams.get("cursor") ?? ""));
}
