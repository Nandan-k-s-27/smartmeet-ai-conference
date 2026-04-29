import type { DefaultSession } from "next-auth";

export type SmartMeetRole = "user" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SmartMeetRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: SmartMeetRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: SmartMeetRole;
  }
}
