import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { validMutationOrigin } from "@/lib/api-policy";
import { materialsEnabled, materialErrorResponse, materialLinkUrl, newLinkId } from "@/lib/materials/server";
import { MaterialError } from "@/lib/materials/policy";
export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};
async function guard(req:NextRequest) {
  if(!materialsEnabled()) throw new MaterialError("Recurso indisponível.",404);
  const auth=await getServerAuth();if(!auth) throw new MaterialError("Entre na plataforma.",401);
  if(!isAdmin(auth)||!validMutationOrigin(req)) throw new MaterialError("Apenas administradores podem gerenciar os links.",403);
  return auth;
}
export async function GET(req:NextRequest,{params}:Params){
  try{await guard(req);const {id}=await params;const link=await prisma.clientMaterialLink.findUnique({where:{clientId:id}});
    return Response.json(link?{url:materialLinkUrl(link.id),enabled:link.enabled}:null,{headers:{"Cache-Control":"no-store"}});
  }catch(e){return materialErrorResponse(e);}
}
export async function POST(req:NextRequest,{params}:Params){
  try{const auth=await guard(req),{id}=await params;const body=await req.json();
    const client=await prisma.client.findUnique({where:{id},select:{id:true,status:true}});
    if(!client||client.status==='INACTIVE') throw new MaterialError("Ative o cliente para receber materiais.",409);
    if(!['create','enable','disable'].includes(body.action)) throw new MaterialError("Ação inválida.");
    const link=await prisma.clientMaterialLink.upsert({where:{clientId:id},create:{id:newLinkId(),clientId:id,createdById:auth.id,enabled:body.action!=='disable'},update:{enabled:body.action!=='disable'}});
    return Response.json({url:materialLinkUrl(link.id),enabled:link.enabled},{headers:{"Cache-Control":"no-store"}});
  }catch(e){return materialErrorResponse(e);}
}
