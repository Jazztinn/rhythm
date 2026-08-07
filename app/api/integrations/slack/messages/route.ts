import { providerAccessToken } from "@/lib/integrations/server";
import { listSlackMessages } from "@/lib/integrations/slack";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = await providerAccessToken("slack");
  const channelId = request.nextUrl.searchParams.get("channel");
  if (!token.data) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 503 });
  if (!channelId) return NextResponse.json({ status: "provider_unavailable", data: null, error: { code: "provider_unavailable", message: "Choose a public channel first.", retryable: false } }, { status: 400 });
  return NextResponse.json(await listSlackMessages(token.data, channelId, request.nextUrl.searchParams.get("cursor") ?? ""));
}
