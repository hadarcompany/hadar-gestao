import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import { guardApiRequest } from "../lib/api-guard";
import type { AuthUser } from "../types/auth";

const root=process.cwd(),nativeRequire=createRequire(resolve(root,"package.json"));
const admin:AuthUser={id:"admin",name:"Admin",email:"admin@example.test",role:"ADMIN",permissions:null,image:null};
function load(path:string,auth:AuthUser|null,db:any,media=(x:any)=>x){
 const module={exports:{} as any};
 const mocks:any={"@/lib/supabase/get-server-auth":{getServerAuth:async()=>auth},"@/lib/prisma":{prisma:db},"@/lib/api-guard":{guardApiRequest},"@/lib/media":{withMedia:media}};
 const source=ts.transpileModule(readFileSync(resolve(root,path),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 runInNewContext(source,{module,exports:module.exports,console,Buffer,URL,Request,Response,process,require:(name:string)=>name in mocks?mocks[name]:nativeRequire(name.startsWith("@/")?resolve(root,name.slice(2)):name)});
 return module.exports;
}
const request=(path:string)=>new NextRequest("https://lists.example.test"+path);

test("client lookup/list keep permission guards and never read history or briefing",async()=>{
 for(const mode of ["lookup","list"]){
  let calls=0,args:any;
  const db={client:{findMany:async(a:any)=>{calls++;args=a;return[{id:"client",name:"Client",status:"ACTIVE"}]}}};
  const route=(auth:AuthUser|null)=>load("app/api/clients/route.ts",auth,db);
  assert.equal((await route(null).GET(request('/api/clients?view='+mode))).status,401);
  assert.equal((await route({...admin,role:"MEMBER",permissions:{}}).GET(request('/api/clients?view='+mode))).status,403);
  assert.equal(calls,0);
  const result=await route(admin).GET(request('/api/clients?view='+mode));assert.equal(result.status,200);assert.equal(calls,1);
  assert.equal(args.include,undefined);assert.equal(args.select.briefing,undefined);assert.equal(args.select.interactions,undefined);assert.equal(args.select.logoUrl,undefined);
  assert.equal(args.select.id,true);assert.equal(args.select.status,true);
  if(mode==='list')assert.equal(args.select._count.select.tasks,true);
 }
});

test("task-only users retain minimal client access; complete endpoint remains compatible",async()=>{
 let args:any;const db={client:{findMany:async(a:any)=>{args=a;return[]}}};
 const limited={...admin,role:"MEMBER" as const,permissions:{tarefas:"view"}};
 await load("app/api/clients/route.ts",limited,db).GET(request('/api/clients?view=list'));
 assert.deepEqual(Object.keys(args.select).sort(),['id','name']);
 await load("app/api/clients/route.ts",admin,db).GET(request('/api/clients'));
 assert.equal(args.include.interactions.take,5);assert.equal(args.omit.logoUrl,true);
});

test("active task scope excludes history in SQL without weakening ownership or filters",async()=>{
 let args:any;const db={task:{findMany:async(a:any)=>{args=a;return[]}}};
 const route=(auth:AuthUser)=>load("app/api/tasks/route.ts",auth,db);
 await route(admin).GET(request('/api/tasks?scope=active&clientId=client&priority=HIGH&assigneeId=person'));
 assert.deepEqual(Array.from(args.where.AND[0].status.notIn),['COMPLETED','CANCELLED']);assert.equal(args.where.clientId,'client');assert.equal(args.where.priority,'HIGH');assert.equal(args.where.assignees.some.userId,'person');
 const personal={...admin,role:"MEMBER" as const,permissions:{'meu-trabalho':'view'}};
 await route(personal).GET(request('/api/tasks?scope=active'));assert.equal(args.where.OR[0].createdById,admin.id);assert.equal(args.where.OR[1].assignees.some.userId,admin.id);
 await route(admin).GET(request('/api/tasks?status=COMPLETED'));assert.equal(args.where.status,'COMPLETED');assert.equal(args.where.AND,undefined);
 assert.equal((await route(admin).GET(request('/api/tasks?sort=invalid'))).status,400);
});

test("profile reuses the verified current account without a second database lookup",async()=>{
 const db={user:{findUnique:()=>{throw Error('redundant read')}}};
 const route=load('app/api/users/me/route.ts',admin,db);
 const r=await route.GET(request('/api/users/me'));assert.equal(r.status,200);assert.deepEqual(await r.json(),admin);
 assert.equal((await load('app/api/users/me/route.ts',null,db).GET(request('/api/users/me'))).status,401);
});

test("production route bundles share one Prisma pool",()=>{
 let instances=0;const shared:any={};const source=ts.transpileModule(readFileSync(resolve(root,'lib/prisma.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const run=()=>{const module={exports:{} as any};runInNewContext(source,{module,exports:module.exports,globalThis:shared,process:{env:{NODE_ENV:'production'}},require:()=>({PrismaClient:class{constructor(){instances++;}}})});return module.exports.prisma;};
 assert.equal(run(),run());assert.equal(instances,1);
});
