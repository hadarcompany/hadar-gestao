import test from "node:test";
import assert from "node:assert/strict";
import { getWorkPeriod, groupWorkTasks } from "../lib/my-work";
import { explicitTaskCategory, taskCategoryLabel, taskContextLabel, taskTypeLabel } from "../lib/task-category";

test("each deadline has one period, with Monday–Sunday week boundaries", () => {
  const today = "2026-11-10";
  const inputs = [
    ["2026-11-09", "OVERDUE"], ["2026-11-10", "TODAY"], ["2026-11-11", "THIS_WEEK"],
    ["2026-11-15", "THIS_WEEK"], ["2026-11-16", "NEXT_WEEK"], ["2026-11-22", "NEXT_WEEK"],
    ["2026-11-23", "LATER"], [null, "NO_DATE"], ["invalid", "NO_DATE"],
  ] as const;
  const tasks = inputs.map(([dueDate], index) => ({ id: index, status: "PENDING", dueDate }));
  inputs.forEach(([dueDate, expected]) => assert.equal(getWorkPeriod({ status: "PENDING", dueDate }, today), expected));
  const groups = groupWorkTasks([...tasks, { id: 90, status: "COMPLETED", dueDate: null }, { id: 91, status: "CANCELLED", dueDate: "2026-11-10" }], today);
  assert.deepEqual(groups.flatMap(g => g.tasks).map(t => t.id).sort((a,b)=>a-b), tasks.map(t=>t.id));
  assert.equal(new Set(groups.flatMap(g=>g.tasks).map(t=>t.id)).size, tasks.length);
});
test("Sunday, new year and UTC calendar deadlines do not drift into a different week", () => {
  assert.equal(getWorkPeriod({ status: "IN_PROGRESS", dueDate: "2027-01-03T00:00:00.000Z" }, "2026-12-31"), "THIS_WEEK");
  assert.equal(getWorkPeriod({ status: "PENDING", dueDate: "2027-01-04" }, "2026-12-31"), "NEXT_WEEK");
  assert.equal(getWorkPeriod({ status: "PENDING", dueDate: "2026-11-16" }, "2026-11-15"), "NEXT_WEEK");
  assert.equal(getWorkPeriod({ status: "PENDING", dueDate: "2026-11-16" }, "2026-11-16"), "TODAY");
});
test("Monday categories retain their meaning without rewriting the imported task", () => {
  for (const [group, expected] of [["Criação", "Criação"], ["Demanda dos clientes", "Demanda dos clientes"], ["Adm Financeiro", "Adm. financeiro"], ["Gestão de Projetos", "Gestão de projetos"]]) {
    const task={type:"tarefa_generica",extraFields:{monday:{group,sourceFile:"Tarefas_Di_rias_1793817711.xlsx",sourceItemId:"123"}}};
    const before=JSON.stringify(task);
    assert.equal(taskCategoryLabel(task),expected);assert.equal(taskContextLabel(task),"Tarefas diárias › "+expected);assert.equal(JSON.stringify(task),before);
  }
  assert.equal(taskCategoryLabel({extraFields:{monday:{group:"Clients",sourceFile:"Projetos_Onboardings.xlsx"}}}),"Onboarding");
});
test("explicit categories, form demands and existing templates are distinguished", () => {
  assert.equal(taskCategoryLabel({type:"reels"}),"Criação");assert.equal(taskTypeLabel({type:"reels"}),"Reels");
  assert.equal(taskTypeLabel({type:"tarefa_generica"}),null);
  assert.equal(taskCategoryLabel({extraFields:{materialSubmission:{needsEditing:true}}}),"Demanda dos clientes");
  assert.equal(taskCategoryLabel({type:"reels",extraFields:{taskCategory:"adm_financeiro"}}),"Adm. financeiro");
  assert.equal(explicitTaskCategory({extraFields:{taskCategory:"invalid"}}),"");
  assert.equal(taskCategoryLabel({}),"Geral");
});
