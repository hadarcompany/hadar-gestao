/* eslint-disable @typescript-eslint/no-explicit-any */
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      permissions: Record<string, string> | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    permissions: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    id: string;
    permissions: any;
  }
}
