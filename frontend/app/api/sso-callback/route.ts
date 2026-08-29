import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL || "http://10.100.101.15:8001";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api/, "");
  const backendUrl = `${BACKEND_URL}${path}${request.nextUrl.search}`;

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return NextResponse.redirect(location, 302);
      }
    }

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("SSO callback proxy error:", error);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
