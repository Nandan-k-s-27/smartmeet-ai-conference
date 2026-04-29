import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createBackendAccessToken, getBackendUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendRouteContext = {
  params:
    | Promise<{
        path?: string[];
      }>
    | {
        path?: string[];
      };
};

async function proxyToBackend(request: NextRequest, context: BackendRouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await Promise.resolve(context.params);
    const path = params.path?.join("/") || "";
    const backendUrl = new URL(`${getBackendUrl()}/${path}`);
    backendUrl.search = request.nextUrl.search;

    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${createBackendAccessToken(session)}`);
    headers.delete("host");
    headers.delete("cookie");
    headers.delete("content-length");

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Backend request failed",
      },
      { status: 502 }
    );
  }
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
