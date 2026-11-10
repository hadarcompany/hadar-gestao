import { NextRequest } from "next/server";
import { validMutationOrigin } from "@/lib/api-policy";
import { getMaterialLink, startMaterialSubmission, completeMaterialSubmission, materialErrorResponse } from "@/lib/materials/server";
import { MaterialError } from "@/lib/materials/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params={params:Promise<{token:string}>};
export async function GET(_req:NextRequest,{params}:Params) {
  try {const {token}=await params, link=await getMaterialLink(token);return Response.json({company:link.client.name},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
  catch(e){return materialErrorResponse(e);}
}
export async function POST(req:NextRequest,{params}:Params) {
  try {
    if(!validMutationOrigin(req)||!req.headers.get("content-type")?.startsWith("application/json")) throw new MaterialError("Origem inválida.",403);
    if(Number(req.headers.get("content-length"))>24000) throw new MaterialError("Solicitação muito grande.",413);
    const raw=await req.text(); if(Buffer.byteLength(raw)>24000) throw new MaterialError("Solicitação muito grande.",413);
    const body=JSON.parse(raw), {token}=await params;
    if(body.website) throw new MaterialError("Envio inválido.");
    const result=body.action==='start' ? await startMaterialSubmission(token,body.id,body.files) : body.action==='submit' ? await completeMaterialSubmission(token,body.id,body) : (()=>{throw new MaterialError("Ação inválida.")})();
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(e){return materialErrorResponse(e);}
}
