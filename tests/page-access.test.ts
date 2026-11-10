import assert from "node:assert/strict";
import { test } from "node:test";
import { canVisitPage, homeForUser } from "../lib/page-access";
import { readDashboardResponse } from "../lib/dashboard-response";
import { MODULE_KEYS } from "../lib/permissions";

test("members land on a permitted page without receiving additional permissions",()=>{
 const permissions={tarefas:'edit','meu-trabalho':'edit',clientes:'view',financeiro:'none',dashboard:'none'};
 const member={role:'MEMBER',permissions};const original=JSON.stringify(member);
 assert.equal(homeForUser(member),'/meu-trabalho');assert.equal(canVisitPage(member,'/dashboard'),false);assert.equal(canVisitPage(member,'/financeiro'),false);assert.equal(canVisitPage(member,'/equipe'),false);
 assert.equal(canVisitPage(member,'/meu-trabalho'),true);assert.equal(canVisitPage(member,'/projetos'),true);assert.equal(canVisitPage(member,'/clientes/client-id'),true);assert.equal(JSON.stringify(member),original);
 assert.equal(homeForUser({role:'ADMIN',permissions:null}),'/dashboard');
});

test("every valid permission set has an accessible destination and no redirect loop",()=>{
 for(const key of MODULE_KEYS)for(const level of ['view','edit']){
  const user={role:'MEMBER',permissions:{[key]:level}};assert.equal(canVisitPage(user,homeForUser(user)),true,key);
 }
 const missing: Array<Record<string,string>|null> = [null,{}, {tarefas:'none'},{dashboard:'invalid'}];
 for(const permissions of missing){
  const user={role:'MEMBER',permissions};assert.equal(homeForUser(user),'/configuracoes');assert.equal(canVisitPage(user,'/configuracoes'),true);
 }
 const user={role:'MEMBER',permissions:{clientes:'view'}};assert.equal(canVisitPage(user,'/projetos'),true);assert.equal(canVisitPage(user,'/onboarding'),true);assert.equal(canVisitPage(user,'/tarefas'),false);
});

test("HTTP errors and incomplete responses cannot become dashboard data",async()=>{
 for(const status of [401,403,500,503])await assert.rejects(readDashboardResponse(Response.json({error:'Forbidden'},{status})));
 for(const data of [{error:'Forbidden'},{},{stats:{}},{stats:{},nextDeliveries:{},upcomingRenewals:[]},{stats:{},nextDeliveries:[],upcomingRenewals:[],financialSummary:{}}])await assert.rejects(readDashboardResponse(Response.json(data)));
 const good={stats:{pending:1},nextDeliveries:[],upcomingRenewals:[],financialSummary:null};assert.deepEqual(await readDashboardResponse(Response.json(good)),good);
});
