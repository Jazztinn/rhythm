import { providerConnection } from "@/lib/integrations/server";
import { success } from "@/lib/integrations/contracts";
import { NextResponse } from "next/server";

export async function GET() {
  const [google, slack] = await Promise.all([providerConnection("google"), providerConnection("slack")]);
  return NextResponse.json(success({ google, slack }));
}
