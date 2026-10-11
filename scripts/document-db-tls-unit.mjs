import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import tls from 'node:tls';
import postgres from 'postgres';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { documentDatabaseTls } = await jiti.import('../lib/document-database-tls.ts');
const saved = { mode: process.env.NODE_ENV, ca: process.env.SITEPM_DATABASE_CA_CERT };
const dir = mkdtempSync(join(tmpdir(), 'sitepm-tls-test-'));
const sockets = new Set();
let server;
try {
  delete process.env.SITEPM_DATABASE_CA_CERT;
  process.env.NODE_ENV = 'development';
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(documentDatabaseTls(`postgresql://test@${host}/test`), false);
  for (const host of ['localhost.example.com', '127.0.0.2', 'example.invalid']) assert.equal(documentDatabaseTls(`postgresql://test@${host}/test`).rejectUnauthorized, true);
  assert.throws(() => documentDatabaseTls('https://example.invalid/test'));
  process.env.NODE_ENV = 'production';
  assert.equal(documentDatabaseTls('postgresql://test@localhost/test').rejectUnauthorized, true);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', join(dir,'key.pem'), '-out', join(dir,'cert.pem'), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], {stdio:'ignore'});
  const cert = readFileSync(join(dir,'cert.pem'), 'utf8');
  const context = tls.createSecureContext({key:readFileSync(join(dir,'key.pem')),cert});
  // PostgreSQL SSLRequest followed by a real TLS handshake. No database/credentials.
  // A synthetic auth error proves a verified connection reached the PostgreSQL stage.
  server = net.createServer(socket => {
    sockets.add(socket); socket.on('close',()=>sockets.delete(socket)); socket.on('error',()=>{});
    socket.once('data', data => {
      assert.equal(data.readInt32BE(4), 80877103);
      socket.write('S');
      const secure = new tls.TLSSocket(socket,{isServer:true,secureContext:context});
      sockets.add(secure);secure.on('close',()=>sockets.delete(secure));secure.on('error',()=>{});
      secure.once('data',()=>{
        const body=Buffer.from('SFATAL\0C28000\0Msynthetic auth boundary\0\0');
        const length=Buffer.alloc(4);length.writeInt32BE(body.length+4);
        secure.end(Buffer.concat([Buffer.from('E'),length,body]));
      });
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const port=server.address().port;
  async function probe(host, expected) {
    const url=`postgresql://synthetic:synthetic@${host}:${port}/synthetic?sslmode=disable`;
    const sql=postgres(url,{host:'127.0.0.1',ssl:documentDatabaseTls(url),connect_timeout:3,max:1,prepare:false});
    assert.equal(sql.options.ssl.rejectUnauthorized,true);
    try {await assert.rejects(sql`select 1`,error=>expected.includes(error.code));}
    finally {await sql.end({timeout:0});}
  }
  process.env.SITEPM_DATABASE_CA_CERT=cert;
  await probe('localhost',['28000']);
  await probe('wrong-host.invalid',['ERR_TLS_CERT_ALTNAME_INVALID']);
  delete process.env.SITEPM_DATABASE_CA_CERT;
  await probe('localhost',['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN']);
  // Execute both actual TypeScript clients with only the database transport mocked.
  for (const file of ['lib/document-verifier.ts','lib/document-extractor-db.ts']) {
    const module={exports:{}};let captured;
    const query=async()=>[{id:'synthetic-extraction',result:'synthetic-result'}];
    query.json=value=>value;query.begin=fn=>fn(query);
    const mockPostgres=(_url,options)=>{captured=options;return query};
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    runInNewContext(code,{module,exports:module.exports,process:{env:{NODE_ENV:'production',SITEPM_DOCUMENT_DATABASE_URL:'postgresql://synthetic@example.invalid/test?sslmode=disable',SITEPM_EXTRACTOR_DATABASE_URL:'postgresql://synthetic@example.invalid/test?sslmode=disable'}},require:name=>{
      if(name==='server-only')return {};
      if(name==='postgres')return mockPostgres;
      if(name==='./document-database-tls')return {documentDatabaseTls};
      throw Error('Unexpected test import');
    }});
    if(file.includes('verifier'))await module.exports.trustedDocumentOperation('synthetic-actor','verify',{request:'synthetic-request',sha:'synthetic-hash',size:1});
    else await module.exports.persistDerivedDocumentExtraction({documentId:'synthetic-document',chunks:[]});
    assert.equal(captured.ssl.rejectUnauthorized,true);
    assert.equal(captured.ssl.servername,'example.invalid');
    assert.equal(typeof captured.ssl.checkServerIdentity,'function');
  }
  console.log('PASS document DB TLS: trusted chain reaches synthetic PostgreSQL auth; wrong hostname/untrusted CA rejected; URL downgrade ignored; development-only loopback; both clients use policy. No production connections.');
} finally {
  for (const socket of sockets) socket.destroy();
  if(server) await new Promise(resolve=>server.close(resolve));
  for (const [key,value] of [['NODE_ENV',saved.mode],['SITEPM_DATABASE_CA_CERT',saved.ca]]) {
    if(value===undefined) delete process.env[key];else process.env[key]=value;
  }
  rmSync(dir,{recursive:true,force:true});
}
