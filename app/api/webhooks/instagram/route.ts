import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const receivedToken =
    request.nextUrl.searchParams.get("hub.verify_token");
  const challenge =
    request.nextUrl.searchParams.get("hub.challenge");

  const expectedToken =
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    receivedToken === expectedToken &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new NextResponse("Forbidden", {
    status: 403,
  });
}
