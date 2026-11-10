import test from "node:test";
import assert from "node:assert/strict";
import { validateFiles, validateSubmission, materialAssignee } from "../lib/materials/policy";
import { instanceBrand } from "../lib/instance-brand";
test("each answer routes to the designated Insider teammate",()=>{
  const env={MATERIALS_EDITOR_EMAIL:"guilherme@example.invalid",MATERIALS_READY_EMAIL:"daniela@example.invalid"};
  assert.equal(materialAssignee(true,env),env.MATERIALS_EDITOR_EMAIL);
  assert.equal(materialAssignee(false,env),env.MATERIALS_READY_EMAIL);
  assert.throws(()=>materialAssignee(true,{}));
  assert.throws(()=>validateSubmission({observations:"Some text",needsEditing:"false"}));
  assert.deepEqual(validateSubmission({observations:" Test material ",needsEditing:false}),{observations:"Test material",needsEditing:false});
});
test("bounded, original media; unsafe file kinds are rejected",()=>{
  const file={name:"image.png",mime:"image/png",bytes:20*1024**2};
  assert.deepEqual(validateFiles([file]),[file]);
  assert.equal(validateFiles([{name:"movie.mp4",mime:"video/mp4",bytes:200*1024**2}]).length,1);
  for(const input of [[{...file,bytes:0}],[{...file,bytes:20*1024**2+1}],[{...file,mime:"image/svg+xml"}],[{...file,mime:"text/html"}],Array(11).fill(file)]) assert.throws(()=>validateFiles(input));
  assert.throws(()=>validateFiles(Array(3).fill({name:"movie.mp4",mime:"video/mp4",bytes:200*1024**2})));
  assert.equal(validateFiles([{...file,name:"../x\r\n.png"}])[0].name,".._x__.png");
});
test("Hadar branding remains the default",()=>{
  const previous=process.env.INSTANCE_BRAND;
  try{delete process.env.INSTANCE_BRAND;assert.equal(instanceBrand(),"hadar");process.env.INSTANCE_BRAND="insider";assert.equal(instanceBrand(),"insider");process.env.INSTANCE_BRAND="unexpected";assert.equal(instanceBrand(),"hadar");}
  finally{if(previous===undefined)delete process.env.INSTANCE_BRAND;else process.env.INSTANCE_BRAND=previous;}
});
