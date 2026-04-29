import "server-only";

import jwt from "jsonwebtoken";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const issuer = "smartmeet-web";
const audience = "smartmeet-api";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is required for backend API calls.");
  }

  return backendUrl.replace(/\/+$/, "");
}

export function getBackendJwtSecret() {
  const secret = process.env.BACKEND_JWT_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("BACKEND_JWT_SECRET or AUTH_SECRET is required.");
  }

  return secret;
}

export function createBackendAccessToken(session: Session) {
  if (!session.user?.id || !session.user.email) {
    throw new Error("Cannot create backend token without an authenticated user.");
  }

  return jwt.sign(
    {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role || "user",
    },
    getBackendJwtSecret(),
    {
      expiresIn: "15m",
      issuer,
      audience,
    }
  );
}
