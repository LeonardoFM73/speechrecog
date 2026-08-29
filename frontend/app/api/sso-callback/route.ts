import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const backendUrl = `${BACKEND_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");

    if (response.redirected) {
      return NextResponse.redirect(response.url, { status: response.status, headers });
    }

    const body = await response.text();
    return new NextResponse(body, { status: response.status, headers });
  } catch (error) {
    console.error("SSO callback proxy error:", error);
    return NextResponse.json(
      { error: "Backend unreachable" },
      { status: 502 }
    );
  }
}
