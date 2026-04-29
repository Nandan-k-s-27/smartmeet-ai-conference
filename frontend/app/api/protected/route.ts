import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth((request) => {
  if (!request.auth?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: request.auth.user,
  });
});
