import { NextResponse } from "next/server";
const removed = () => NextResponse.json({ error: "Área de Acessos removida." }, { status: 410 });
export const GET = removed;
export const POST = removed;
