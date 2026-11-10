import importlib.util
import tempfile
import json
import time
import hmac
import hashlib
import io
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('materials',Path(__file__).resolve().parent.parent/'deploy/materials/server.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class StorageTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);self.key=b'x'*48;(root/'key').write_bytes(self.key)
  self.store=mod.Store({'directory':str(root/'objects'),'origins':['https://test.invalid'],'limitBytes':500*1024**2,'minFreeBytes':0,'instances':{'insider-materials':{'secretFile':str(root/'key'),'limitBytes':500*1024**2}}})
 def tearDown(self): self.tmp.cleanup()
 def data(self,mime='image/png',size=20):
  return {'i':'insider-materials','p':'1234567890abcdef/12345678-1234-4234-8234-123456789012.'+mod.MIMES[mime],'s':size,'m':mime,'a':'upload','e':int(time.time())+100}
 def ticket(self,d):
  payload=mod.spool.b64(json.dumps(d).encode());return payload+'.'+mod.spool.b64(hmac.new(self.key,payload.encode(),hashlib.sha256).digest())
 def test_actions_tenants_expiry_and_paths(self):
  d=self.data();self.assertEqual(self.store.authorize(self.ticket(d),'upload'),d)
  for changes in [{'a':'read'},{'e':int(time.time())-1},{'p':'../../etc/passwd'},{'i':'hadar'},{'s':201*1024**2},{'m':'image/svg+xml'}]:
   with self.assertRaises(mod.spool.Reject):self.store.authorize(self.ticket(d|changes),'upload')
 def test_magic_and_immutable_retry(self):
  payload=b'\x89PNG\r\n\x1a\n'+b'0'*12;d=self.data(size=len(payload));self.store.init(d)
  self.store.chunk(d,0,len(payload),io.BytesIO(payload));self.store.chunk(d,0,len(payload),io.BytesIO(payload))
  with self.assertRaises(mod.spool.Reject):self.store.chunk(d,0,len(payload),io.BytesIO(b'x'*len(payload)))
  self.assertEqual(self.store.complete(d)['sha256'],hashlib.sha256(payload).hexdigest())
  self.assertEqual(self.store.complete(d)['bytes'],len(payload))
  self.assertEqual((self.store.folder(d)/'object').read_bytes(),payload)
 def test_declared_image_cannot_be_html(self):
  payload=b'<html>not an image</html>';d=self.data(size=len(payload));self.store.init(d);self.store.chunk(d,0,len(payload),io.BytesIO(payload))
  with self.assertRaises(mod.spool.Reject):self.store.complete(d)
 def test_200mb_transport_and_assembly_stay_chunked(self):
  # Binary transport fixture, not a playable-video/codec validation.
  size=200*1024**2;d=self.data('video/mp4',size);self.store.authorize(self.ticket(d),'upload');self.store.init(d)
  digest=hashlib.sha256()
  for index,offset in enumerate(range(0,size,mod.spool.CHUNK)):
   part=bytearray(min(mod.spool.CHUNK,size-offset))
   if index==0:part[:12]=b'\x00\x00\x00\x18ftypmp42'
   digest.update(part);self.store.chunk(d,index,len(part),io.BytesIO(part))
  result=self.store.complete(d);self.assertEqual(result['bytes'],size);self.assertEqual(result['sha256'],digest.hexdigest())
  self.assertEqual((self.store.folder(d)/'object').stat().st_size,size)

if __name__=='__main__':unittest.main()
