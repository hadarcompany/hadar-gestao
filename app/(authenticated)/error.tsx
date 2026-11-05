"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { homeForUser } from "@/lib/page-access";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  const { user } = useAuth();
  return (
    <section role="alert" className="rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-gray-900">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm text-gray-600">Tente novamente ou volte para sua página inicial.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark">Tentar novamente</button>
        <Link href={user ? homeForUser(user) : "/login"} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Página inicial</Link>
      </div>
    </section>
  );
}
