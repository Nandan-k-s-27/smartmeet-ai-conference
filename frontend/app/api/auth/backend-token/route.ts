import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createBackendAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      token: createBackendAccessToken(session),
      tokenType: "Bearer",
      expiresIn: 900,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create backend token" },
      { status: 500 }
    );
  }
}
