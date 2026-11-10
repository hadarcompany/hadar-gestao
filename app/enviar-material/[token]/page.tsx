import { notFound } from "next/navigation";
import { getMaterialLink } from "@/lib/materials/server";
import { MaterialError } from "@/lib/materials/policy";
import { MaterialForm } from "@/components/materials/material-form";
export const dynamic="force-dynamic";
export const metadata={title:"Envio de materiais | Insider",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function MaterialPage({params}:{params:Promise<{token:string}>}) {
  try { const {token}=await params,link=await getMaterialLink(token);return <MaterialForm token={token} company={link.client.name}/>; }
  catch(e){ if(e instanceof MaterialError && e.status===404) notFound();return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Formulário indisponível</h1><p className="mt-3">Não foi possível abrir este formulário agora. Tente novamente ou entre em contato com a Insider.</p></main>; }
}
