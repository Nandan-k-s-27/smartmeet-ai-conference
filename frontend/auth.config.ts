import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const protectedRoutes = ["/dashboard", "/meeting"];

const getRole = (email?: string | null) => {
  const adminEmails = (process.env.AUTH_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return email && adminEmails.includes(email.toLowerCase()) ? "admin" : "user";
};

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      const oauthProfile = profile as
        | { sub?: string; email?: string; name?: string; picture?: string }
        | undefined;
      const email = user?.email || token.email || oauthProfile?.email;

      if (user || profile) {
        token.id = user?.id || token.sub || oauthProfile?.sub;
        token.email = email;
        token.name = user?.name || token.name || oauthProfile?.name;
        token.picture = user?.image || token.picture || oauthProfile?.picture;
        token.role = getRole(email);
      }

      if (!token.role) {
        token.role = getRole(email);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || token.sub || "");
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
        session.user.image = (token.picture as string | undefined) || session.user.image;
        session.user.role = (token.role as "user" | "admin" | undefined) || "user";
      }

      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isProtectedRoute = protectedRoutes.some((route) =>
        nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
      );

      if (auth?.user && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl.origin));
      }

      if (isProtectedRoute) {
        return !!auth?.user;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
