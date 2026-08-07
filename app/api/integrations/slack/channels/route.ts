import { providerAccessToken } from "@/lib/integrations/server";
import { listSlackChannels } from "@/lib/integrations/slack";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = await providerAccessToken("slack");
  if (!token.data) return NextResponse.json(token, { status: token.status === "not_connected" ? 401 : 503 });
  return NextResponse.json(await listSlackChannels(token.data, request.nextUrl.searchParams.get("cursor") ?? ""));
}
