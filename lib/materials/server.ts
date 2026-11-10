import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { trialExpired } from "@/lib/instance-trial";
import { publicOrigin } from "@/lib/public-url";
import { MaterialError, MATERIAL_MIMES, MaterialAsset, validateFiles, validateSubmission, materialAssignee } from "./policy";
import { materialOperation, materialReference, materialUpload } from "./storage";
export function materialsEnabled() { return process.env.INSTANCE_BRAND === "insider" && process.env.MATERIALS_ENABLED === "true"; }
function secret() {
  const value=process.env.MATERIALS_LINK_SECRET || "";
  if (!materialsEnabled() || value.length < 32) throw new MaterialError("Formulário indisponível.",404);
  if (trialExpired()) throw new MaterialError("O recebimento de materiais está temporariamente indisponível. Entre em contato com a equipe.",402);
  return value;
}
export function linkToken(id: string) { return id + "." + createHmac("sha256", secret()).update("material-link:"+id).digest("base64url"); }
export function materialLinkUrl(id: string) { return publicOrigin(process.env.APP_URL || "") + "/enviar-material/" + linkToken(id); }
export async function getMaterialLink(token: string) {
  secret();
  if (!/^[a-f0-9]{48}\.[A-Za-z0-9_-]{43}$/.test(token)) throw new MaterialError("Este link não está disponível. Peça um novo link à equipe.",404);
  const id=token.split(".")[0], expected=linkToken(id);
  if (!timingSafeEqual(Buffer.from(expected),Buffer.from(token))) throw new MaterialError("Link inválido.",404);
  const link=await prisma.clientMaterialLink.findUnique({where:{id},include:{client:{select:{id:true,name:true,status:true}}}});
  if (!link?.enabled || link.client.status === "INACTIVE") throw new MaterialError("Este link não está disponível. Peça um novo link à equipe.",404);
  return link;
}
export function newLinkId() { return randomBytes(24).toString("hex"); }
function uuid(value: string) { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new MaterialError("Solicitação inválida."); }
export async function startMaterialSubmission(token: string, id: string, input: unknown) {
  uuid(id); const link=await getMaterialLink(token), files=validateFiles(input);
  const prefix=randomBytes(8).toString("hex");
  const submission=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.id}))`;
    const old=await tx.clientMaterialSubmission.findUnique({where:{id}});
    if (old) {
      if (old.linkId !== link.id || JSON.stringify((old.assets as unknown as MaterialAsset[]).map(a=>({name:a.name,mime:a.mime,bytes:a.bytes}))) !== JSON.stringify(files)) throw new MaterialError("O envio já foi iniciado com outros arquivos. Recarregue o formulário.",409);
      return old;
    }
    const count=await tx.clientMaterialSubmission.count({where:{linkId:link.id,createdAt:{gte:new Date(Date.now()-3600000)}}});
    if (count>=20) throw new MaterialError("Limite de envios atingido. Tente novamente mais tarde ou fale com a equipe.",429);
    const assets=files.map(f=>({...f,id:randomUUID(),path:prefix+"/"+randomUUID()+"."+MATERIAL_MIMES[f.mime]}));
    return tx.clientMaterialSubmission.create({data:{id,linkId:link.id,assets}});
  });
  if(submission.submitted) return {submitted:true};
  if(Date.now()-submission.createdAt.getTime()>86400000) throw new MaterialError("Este envio expirou. Recarregue o formulário.",410);
  const assets=submission.assets as unknown as MaterialAsset[];
  const uploads=[];
  for(const asset of assets) {
    await materialOperation(asset,"init");
    let ready=false;
    try { const info=await materialOperation(asset,"info");ready=info.bytes===asset.bytes&&info.mime===asset.mime; } catch { /* Incomplete upload resumes with immutable chunks. */ }
    uploads.push({...materialUpload(asset),ready});
  }
  return {uploads};
}
export async function completeMaterialSubmission(token: string,id: string,input: unknown) {
  uuid(id); const link=await getMaterialLink(token), body=validateSubmission(input);
  const submission=await prisma.clientMaterialSubmission.findUnique({where:{id}});
  if(!submission || submission.linkId!==link.id) throw new MaterialError("Envio não encontrado.",404);
  if(submission.submitted) return {ok:true};
  if(Date.now()-submission.createdAt.getTime()>86400000) throw new MaterialError("Este envio expirou. Recarregue o formulário.",410);
  const assets=submission.assets as unknown as MaterialAsset[];
  for(const a of assets) { const info=await materialOperation(a,"complete"); if(info.bytes!==a.bytes||info.mime!==a.mime) throw new MaterialError("Arquivo incompleto.",409); }
  const assignee=await prisma.user.findUnique({where:{email:materialAssignee(body.needsEditing)},select:{id:true}});
  if(!assignee) throw new MaterialError("Não foi possível distribuir esta tarefa. Entre em contato com a equipe.",503);
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.id}))`;
    const active=await tx.clientMaterialLink.findUnique({where:{id:link.id},include:{client:{select:{status:true}}}});
    if(!active?.enabled||active.client.status==='INACTIVE') throw new MaterialError("O link foi desativado.",404);
    const current=await tx.clientMaterialSubmission.findUniqueOrThrow({where:{id}});
    if(current.submitted) return;
    const task=await tx.task.create({data:{id:"material."+id,title:`Material de ${link.client.name}: ${body.observations.replace(/\s+/g," ").slice(0,100)}`,description:`Enviado pelo cliente pelo formulário de materiais.\nEmpresa: ${link.client.name}\nPrecisa de edição: ${body.needsEditing ? "Sim" : "Não"}\n\n${body.observations}`,type:"tarefa_generica",status:"PENDING",priority:"MEDIUM",clientId:link.clientId,createdById:link.createdById,tags:["formulario-materiais"],extraFields:{materialSubmission:{id,needsEditing:body.needsEditing,source:"formulario-publico"}},assignees:{create:{userId:assignee.id}},attachments:{create:assets.map(a=>({fileName:a.name,mimeType:a.mime,size:a.bytes,data:materialReference(a),uploadedById:link.createdById}))}}});
    await tx.clientMaterialSubmission.update({where:{id},data:{taskId:task.id,submitted:true}});
  },{timeout:20000});
  return {ok:true};
}
export function materialErrorResponse(error: unknown) {
  const known=error instanceof MaterialError;
  if(!known) console.error("MATERIAL_REQUEST_FAILED", (error as {code?:string})?.code || "unknown");
  return Response.json({error:known?error.message:"Não foi possível concluir agora. Tente novamente."},{status:known?error.status:503,headers:{"Cache-Control":"no-store"}});
}
