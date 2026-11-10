// Dedicated test database only. No production credentials or social APIs are used.
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const env=require('dotenv').parse(fs.readFileSync('.env.finance-test'));
const url=new URL(env.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'16544');
const {PrismaClient}=require('@prisma/client');const admin=new PrismaClient({datasourceUrl:url.href});
url.pathname='/materials_test_20261110';
(async()=>{
 let p,restoreFetch=global.fetch;
 try{
  const found=await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname='materials_test_20261110'`;
  if(!found.length)await admin.$executeRawUnsafe('CREATE DATABASE materials_test_20261110');
  p=new PrismaClient({datasourceUrl:url.href});
  assert.equal((await p.$queryRaw`SELECT current_database() name`)[0].name,'materials_test_20261110');
  const tables=await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  if(!tables.length)cp.execFileSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:url.href,DIRECT_URL:url.href},stdio:'pipe'});
  assert.equal(await p.user.count(),0,'Disposable test database must contain no accounts.');
  Object.assign(process.env,{DATABASE_URL:url.href,DIRECT_URL:url.href,INSTANCE_BRAND:'insider',MATERIALS_ENABLED:'true',MATERIALS_LINK_SECRET:'test-links-'.repeat(8),MATERIALS_STORAGE_SECRET:'test-storage-'.repeat(8),MATERIALS_STORAGE_URL:'https://materials.example.invalid/material-storage/',MATERIALS_EDITOR_EMAIL:'editor@example.invalid',MATERIALS_READY_EMAIL:'ready@example.invalid',INSTANCE_TRIAL_ENDS_AT:'',APP_URL:'https://insider.example.invalid'});
  const {prisma}=await import('../lib/prisma.ts');
  const service=await import('../lib/materials/server.ts');
  const requests=[];global.fetch=async(input,options)=>{
   const u=new URL(input);assert.equal(u.origin,'https://materials.example.invalid');
   const ticket=options.headers.Authorization.slice(7),parts=ticket.split('.');assert.equal(parts[1],crypto.createHmac('sha256',process.env.MATERIALS_STORAGE_SECRET).update(parts[0]).digest('base64url'));
   const d=JSON.parse(Buffer.from(parts[0],'base64url'));requests.push(d);
   return new Response(JSON.stringify({bytes:d.s,mime:d.m,sha256:'a'.repeat(64)}),{status:d.a==='info'?409:200});
  };
  const owner=await p.user.create({data:{id:'materials-test-admin',name:'Admin',email:'admin@example.invalid',password:'no-auth-fixture',role:'ADMIN'}});
  const editor=await p.user.create({data:{id:'materials-test-editor',name:'Guilherme',email:process.env.MATERIALS_EDITOR_EMAIL,password:'no-auth-fixture'}});
  const ready=await p.user.create({data:{id:'materials-test-ready',name:'Daniela',email:process.env.MATERIALS_READY_EMAIL,password:'no-auth-fixture'}});
  const a=await p.client.create({data:{id:'materials-test-a',name:'Company A'}}),b=await p.client.create({data:{id:'materials-test-b',name:'Company B'}});
  const linkA=await p.clientMaterialLink.create({data:{id:service.newLinkId(),clientId:a.id,createdById:owner.id}}),linkB=await p.clientMaterialLink.create({data:{id:service.newLinkId(),clientId:b.id,createdById:owner.id}});
  const token=service.linkToken(linkA.id),foreignToken=service.linkToken(linkB.id);
  assert.equal((await service.getMaterialLink(token)).client.id,a.id);
  await assert.rejects(()=>service.getMaterialLink(token.slice(0,-1)+(token.endsWith('x')?'y':'x')));
  const id=crypto.randomUUID(),files=[{name:'reference.png',mime:'image/png',bytes:123}];
  await service.startMaterialSubmission(token,id,files);
  await assert.rejects(()=>service.startMaterialSubmission(foreignToken,id,files));
  await assert.rejects(()=>service.startMaterialSubmission(token,id,[{...files[0],bytes:124}]));
  const body={observations:'Produce this material',needsEditing:true,clientId:b.id};
  await assert.rejects(()=>service.completeMaterialSubmission(foreignToken,id,body));
  await Promise.all([service.completeMaterialSubmission(token,id,body),service.completeMaterialSubmission(token,id,body)]);
  await service.completeMaterialSubmission(token,id,body);
  let tasks=await p.task.findMany({include:{assignees:true,attachments:true}});assert.equal(tasks.length,1);assert.equal(tasks[0].clientId,a.id);assert.equal(tasks[0].assignees[0].userId,editor.id);assert.equal(tasks[0].attachments.length,1);assert.ok(tasks[0].attachments[0].data.startsWith('vps-material:'));assert.equal(tasks[0].attachments[0].size,123);
  const id2=crypto.randomUUID();await service.startMaterialSubmission(token,id2,[]);await service.completeMaterialSubmission(token,id2,{observations:'Ready to publish',needsEditing:false});
  const task2=await p.task.findUniqueOrThrow({where:{id:'material.'+id2},include:{assignees:true}});assert.equal(task2.assignees[0].userId,ready.id);
  await p.clientMaterialLink.update({where:{id:linkA.id},data:{enabled:false}});await assert.rejects(()=>service.getMaterialLink(token));await p.clientMaterialLink.update({where:{id:linkA.id},data:{enabled:true}});
  await p.client.update({where:{id:a.id},data:{status:'INACTIVE'}});await assert.rejects(()=>service.getMaterialLink(token));await p.client.update({where:{id:a.id},data:{status:'ACTIVE'}});
  process.env.INSTANCE_TRIAL_ENDS_AT='2000-01-01T00:00:00Z';await assert.rejects(()=>service.getMaterialLink(token));delete process.env.INSTANCE_TRIAL_ENDS_AT;
  for(let i=0;i<18;i++)await service.startMaterialSubmission(token,crypto.randomUUID(),[]);
  await assert.rejects(()=>service.startMaterialSubmission(token,crypto.randomUUID(),[]),e=>e.status===429);
  await p.task.deleteMany();await p.client.deleteMany();await p.user.deleteMany();await prisma.$disconnect();
  console.log(JSON.stringify({passed:true,isolatedDatabase:url.pathname.slice(1),cases:['per-client isolation','signed scoped storage grants','original attachment metadata','editing to Guilherme','ready to Daniela','concurrent retries create one task','revocation','inactive client','expired trial','rate limits'],fixturesRemoved:true}));
 }finally{global.fetch=restoreFetch;await p?.$disconnect();await admin.$disconnect();}
})().catch(e=>{console.error(e.message?.slice(0,500)||e.code);process.exitCode=1});
