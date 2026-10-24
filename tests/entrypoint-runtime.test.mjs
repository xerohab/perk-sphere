import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
test('every backend entry registers one callable handler in the production Deno runtime',async()=>{
 const root=fileURLToPath(new URL('../base44/functions/',import.meta.url));
 const entries=fs.readdirSync(root).map(name=>path.join(root,name,'entry.ts')).filter(file=>fs.existsSync(file));
 assert.ok(entries.length>40);
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw Error('Backend startup must not perform network requests');};
  for(const file of entries){
   const handlers=[];
   globalThis.Deno={serve:handler=>{handlers.push(handler);return {};}};
   const module=await import(pathToFileURL(file).href+'?entry-registration-test');
   assert.equal(handlers.length,1,path.basename(path.dirname(file))+' must start exactly one request server');
   assert.equal(typeof handlers[0],'function');
   if(module.default)assert.equal(handlers[0],module.default,'Tests and production must execute the same business handler');
  }
 }finally{globalThis.Deno=previousDeno;globalThis.fetch=previousFetch;}
});
