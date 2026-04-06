// NextAuth removido — autenticação migrada para Supabase Auth
// Endpoints de auth: /api/auth/login e /api/auth/logout
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Use /api/auth/login" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Use /api/auth/login" }, { status: 410 });
}
