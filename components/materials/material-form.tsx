"use client";
import { useRef, useState } from "react";
import { Upload, X, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { validateFiles } from "@/lib/materials/policy";
const field="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2";
export function MaterialForm({token,company}:{token:string;company:string}) {
  const [observations,setObservations]=useState(""),[editing,setEditing]=useState(""),[files,setFiles]=useState<File[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState(""),[done,setDone]=useState(false);
  const requestId=useRef("");const picker=useRef<HTMLInputElement>(null);
  const api=`/api/public/materials/${token}`;
  function addFiles(input:File[]) {
    const next=[...files];for(const f of input) if(!next.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified)) next.push(f);
    try{validateFiles(next.map(f=>({name:f.name,mime:f.type,bytes:f.size})));setFiles(next);requestId.current="";setError("");}
    catch(e){setError((e as Error).message);}
  }
  async function post(body:unknown){const res=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await res.json();if(!res.ok) throw new Error(result.error||"Não foi possível enviar.");return result;}
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      const website=new FormData(e.currentTarget).get("website");
      requestId.current ||= crypto.randomUUID();
      setProgress("Preparando o envio…");
      const start=await post({action:"start",id:requestId.current,files:files.map(f=>({name:f.name,mime:f.type,bytes:f.size})),website});
      if(!start.submitted) {
        for(let i=0;i<files.length;i++) {
          const file=files[i],upload=start.uploads[i];if(upload.ready)continue;
          for(let offset=0,index=0;offset<file.size;offset+=upload.chunkBytes,index++) {
            setProgress(`Arquivo ${i+1} de ${files.length}: ${Math.round(offset/file.size*100)}%`);
            let sent=false;
            for(let attempt=0;attempt<3&&!sent;attempt++) {
              try{const res=await fetch(`${upload.url}?index=${index}`,{method:"PUT",headers:{Authorization:`Bearer ${upload.token}`},body:file.slice(offset,offset+upload.chunkBytes),signal:AbortSignal.timeout(60000)});if(!res.ok)throw new Error();sent=true;}catch{if(attempt===2)throw new Error("O envio do arquivo foi interrompido. Tente enviar novamente; os arquivos selecionados foram mantidos.");}
            }
          }
        }
        setProgress("Concluindo e criando a tarefa…");
        await post({action:"submit",id:requestId.current,observations,needsEditing:editing==="yes",website});
      }
      setDone(true);setFiles([]);
    }catch(e){setError((e as Error).message||"Não foi possível enviar. Tente novamente.");}
    finally{setBusy(false);setProgress("");}
  }
  return <main className="min-h-screen bg-accent px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-2xl rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-12 sm:py-10">
      <Logo width={112} height={36}/>
      {done?<section className="py-12" aria-live="polite"><CheckCircle2 className="mb-5 text-emerald-600" size={32}/><h1 className="text-2xl font-semibold">Material enviado</h1><p className="mt-3 text-gray-600">A equipe da Insider recebeu sua solicitação para {company}. A tarefa já foi criada com os materiais enviados.</p><button className="mt-8 rounded-lg bg-accent-dark px-5 py-3 font-medium text-white" onClick={()=>{setDone(false);setObservations("");setEditing("");requestId.current="";}}>Enviar outro material</button></section>:
      <form onSubmit={submit} className="mt-7 space-y-7" aria-busy={busy}>
        <header><h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">Envio de materiais para o marketing</h1><p className="mt-3 text-sm leading-relaxed text-gray-600">Envie fotos, vídeos e informações para a equipe criar seu conteúdo. Inclua preços, nomes e detalhes que precisam aparecer na publicação.</p></header>
        <div><label htmlFor="company" className="mb-2 block font-medium">Nome da empresa</label><input id="company" className={field+" bg-gray-50"} value={company} readOnly/><p className="mt-2 text-xs text-gray-500">Este link é exclusivo da sua empresa.</p></div>
        <div><label htmlFor="observations" className="mb-2 block font-medium">Observações <span className="text-sm font-normal text-gray-500">(obrigatório)</span></label><p id="observations-help" className="mb-2 text-sm leading-relaxed text-gray-500">Descreva o que deve ser feito e os detalhes do produto ou serviço.</p><textarea id="observations" aria-describedby="observations-help" className={field} rows={5} required minLength={3} maxLength={10000} value={observations} onChange={e=>setObservations(e.target.value)} disabled={busy}/></div>
        <div><label htmlFor="editing" className="mb-2 block font-medium">Esse material precisa de edição antes de ser publicado?</label><select id="editing" required className={field} value={editing} onChange={e=>setEditing(e.target.value)} disabled={busy}><option value="">Selecione uma opção</option><option value="yes">Sim, precisa de edição</option><option value="no">Não, o material está pronto</option></select></div>
        <div><label htmlFor="files" className="mb-2 block font-medium">Anexe fotos e/ou vídeos</label><p id="files-help" className="mb-3 text-sm leading-relaxed text-gray-500">Até 10 arquivos: JPG, PNG ou WebP de até 20 MB e MP4 de até 200 MB. Máximo de 500 MB por envio.</p>
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-7 text-center" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)addFiles(Array.from(e.dataTransfer.files));}}>
            <Upload size={24} className="mx-auto mb-3 text-gray-500" aria-hidden="true"/><input ref={picker} id="files" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4" aria-describedby="files-help" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-4 file:py-2.5 file:font-medium file:text-accent-dark" disabled={busy} onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value="";}}/><p className="mt-3 text-xs text-gray-500">Ou arraste os arquivos para esta área.</p>
          </div>
          {files.length>0&&<ul className="mt-3 divide-y divide-gray-100">{files.map((file,i)=><li key={`${file.name}-${i}`} className="flex items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1 break-all">{file.name} <span className="whitespace-nowrap text-xs text-gray-500">({(file.size/1024**2).toFixed(1)} MB)</span></span><button type="button" className="rounded p-2 text-gray-500 hover:bg-gray-100" disabled={busy} aria-label={`Remover ${file.name}`} onClick={()=>{setFiles(files.filter((_,n)=>n!==i));requestId.current="";}}><X size={18}/></button></li>)}</ul>}
        </div>
        <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
        {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <footer className="border-t border-gray-200 pt-5"><p className="mb-4 text-xs leading-relaxed text-gray-500">Ao enviar, seus materiais serão compartilhados com a equipe da Insider para atender esta solicitação. Para dúvidas sobre o uso ou a exclusão dos materiais, fale com o contato da Insider que enviou este link.</p><button type="submit" disabled={busy} className="w-full rounded-lg bg-accent-dark px-6 py-3 font-semibold text-white hover:bg-accent disabled:cursor-wait disabled:opacity-70 sm:w-auto">{busy?"Enviando…":"Enviar materiais"}</button><p role="status" className="mt-3 text-sm text-gray-600">{progress}</p></footer>
      </form>}
    </div>
  </main>;
}
