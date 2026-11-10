#!/usr/bin/env python3
"""Remove only old orphaned materials after a successful database inventory.

Submitted task attachments remain until removed from the app. Database failures
abort cleanup, and no names, URLs or credentials are written to logs.
"""
import json
import shutil
import subprocess
import time
from pathlib import Path

CODE = r'''
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{try{
const attachments=await p.taskAttachment.findMany({where:{data:{startsWith:'vps-material:'}},select:{data:true}});
const drafts=await p.clientMaterialSubmission.findMany({where:{submitted:false,createdAt:{gt:new Date(Date.now()-86400000)}},select:{assets:true}});
console.log(JSON.stringify([...attachments.map(a=>JSON.parse(a.data.slice(13)).path),...drafts.flatMap(d=>d.assets.map(a=>a.path))]));
}finally{await p.$disconnect()}})().catch(()=>process.exit(1));
'''

if __name__ == '__main__':
    result=subprocess.run(['docker','exec','-i','gestao-insidermidia-app-1','node'],input=CODE,text=True,capture_output=True,timeout=120,check=True)
    protected=set(json.loads(result.stdout))
    root=Path('/srv/insider-materials/insider-materials').resolve()
    removed=0
    for manifest_path in root.glob('*/manifest.json'):
        manifest=json.loads(manifest_path.read_text())
        cutoff=7*86400 if manifest.get('ready') else 2*86400
        folder=manifest_path.parent.resolve()
        assert folder.parent==root
        if manifest['p'] not in protected and time.time()-manifest.get('createdAt',time.time())>cutoff:
            shutil.rmtree(folder);removed+=1
    print(json.dumps({'orphanedMaterialsRemoved':removed}))
