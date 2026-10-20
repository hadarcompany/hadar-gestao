import { open, readFile, access, link, unlink } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createDecipheriv, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
const [source, keyFile, destination] = process.argv.slice(2);
if (!source || !keyFile || !destination) throw new Error('Use: node decrypt-backup.mjs arquivo.hgb chave.txt saida.tar');
try { await access(destination); throw new Error('O arquivo de destino já existe.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const magic = Buffer.from('HADAR-BACKUP-v1\0');
const hex = (await readFile(keyFile, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Chave inválida.');
const handle = await open(source, 'r');
const size = (await handle.stat()).size;
const header = Buffer.alloc(magic.length + 12), tag = Buffer.alloc(16);
await handle.read(header, 0, header.length, 0);
await handle.read(tag, 0, 16, size - 16);
await handle.close();
if (size < header.length + 16 || !header.subarray(0, magic.length).equals(magic)) throw new Error('Formato de backup inválido.');
const cipher = createDecipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), header.subarray(magic.length));
cipher.setAAD(magic); cipher.setAuthTag(tag);
const temporary = destination + '.' + randomUUID() + '.partial';
try {
  await pipeline(createReadStream(source, {start: header.length, end: size - 17}), cipher, createWriteStream(temporary, {flags:'wx',mode:0o600}));
  await link(temporary, destination);
  console.log('Backup autenticado e decifrado.');
} finally { await unlink(temporary).catch(()=>{}); }
