import Link from "next/link";
import { Logo } from "@/components/logo";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f4] px-6 py-8 sm:py-12">
      <header className="mx-auto flex max-w-[72ch] flex-wrap items-center justify-between gap-6 border-b border-[#d6d3d1] pb-6">
        <Link href="/login" aria-label="Hadar Gestão — entrar" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9a3412]">
          <Logo width={150} height={45} className="text-accent-dark" />
        </Link>
        <Link href="/login" className="text-sm font-medium underline underline-offset-4 hover:text-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Entrar no Gestão</Link>
      </header>
      <main className="mx-auto max-w-[72ch] py-10 text-base leading-7 text-[#292524] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_a]:break-words [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-[#9a3412] [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-sm text-[#57534e]">Hadar Gestão · Atualizado em 22 de outubro de 2026</p>
        {children}
      </main>
      <footer className="mx-auto flex max-w-[72ch] flex-wrap gap-x-6 gap-y-3 border-t border-[#d6d3d1] py-6 text-sm">
        <Link href="/privacidade" className="underline underline-offset-4">Privacidade</Link>
        <Link href="/exclusao-de-dados" className="underline underline-offset-4">Exclusão de dados</Link>
        <a href="mailto:contato@agenciahadar.com.br" className="break-all underline underline-offset-4">contato@agenciahadar.com.br</a>
      </footer>
    </div>
  );
}
