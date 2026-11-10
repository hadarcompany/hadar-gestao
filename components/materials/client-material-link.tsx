"use client";
import { useEffect, useState } from "react";
import { useBrand } from "@/contexts/brand-context";
import { useAuth } from "@/contexts/auth-context";
export function ClientMaterialLink({clientId}:{clientId:string}) {
  const brand=useBrand(),{user}=useAuth();const [link,setLink]=useState<{url:string;enabled:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false);
  useEffect(()=>{setLink(null);setError("");setCopied(false);if(brand!=="insider"||user?.role!=="ADMIN")return;let alive=true;fetch(`/api/clients/${clientId}/material-link`).then(async r=>{if(!r.ok)throw new Error("Não foi possível carregar o link.");return r.json();}).then(data=>{if(alive)setLink(data);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[clientId,brand,user?.role]);
  if(brand!=="insider"||user?.role!=="ADMIN")return null;
  async function save(action:string){setBusy(true);setError("");try{const r=await fetch(`/api/clients/${clientId}/material-link`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});const data=await r.json();if(!r.ok)throw new Error(data.error);setLink(data);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="rounded-lg border border-gray-200 bg-white p-4"><h3 className="font-semibold text-gray-900">Link de envio de materiais</h3><p className="mt-2 text-sm text-gray-600">O cliente envia texto, fotos e vídeos sem login. Com edição: Guilherme. Sem edição: Daniela.</p>
    {link&&<><label htmlFor="material-link" className="mt-3 block text-xs text-gray-500">Link exclusivo deste cliente {link.enabled?"(ativo)":"(desativado)"}</label><input id="material-link" className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs" value={link.url} readOnly onFocus={e=>e.target.select()}/></>}
    <div className="mt-3 flex flex-wrap gap-2 text-sm">{!link?<button disabled={busy} onClick={()=>save("create")} className="rounded-lg bg-accent-dark px-4 py-2 text-white">{busy?"Criando…":"Criar link"}</button>:<><button disabled={busy||!link.enabled} onClick={async()=>{try{await navigator.clipboard.writeText(link.url);setCopied(true);}catch{setError("Selecione e copie o link no campo acima.");}}} className="rounded-lg border border-gray-300 px-3 py-2">{copied?"Link copiado":"Copiar link"}</button>{link.enabled&&<a href={link.url} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-300 px-3 py-2">Abrir formulário</a>}<button disabled={busy} onClick={()=>save(link.enabled?"disable":"enable")} className="rounded-lg border border-gray-300 px-3 py-2">{busy?"Salvando…":link.enabled?"Desativar link":"Ativar link"}</button></>}</div>
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
