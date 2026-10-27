import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let code=await readFile(new URL('../base44/functions/dailyLoginStatus/entry.ts',import.meta.url),'utf8');
code=code.replace("import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';","const createClientFromRequest=globalThis.__status.client;").replace("import {secrets} from 'base44:runtime';","const secrets=globalThis.__status.secrets;");
let user=null,flag;globalThis.__status={client:()=>({auth:{me:async()=>user}}),secrets:{get:()=>{if(flag==='error')throw Error('missing');return flag;}}};
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const req=()=>new Request('https://test.invalid',{method:'POST',body:'{}'});
test('status requires member authentication and fails closed for missing settings',async()=>{assert.equal((await handler(req())).status,401);user={id:'MEMBER'};for(const value of [undefined,'false','error']){flag=value;const r=await handler(req());assert.deepEqual(await r.json(),{enabled:false});assert.equal(r.headers.get('Cache-Control'),'no-store');}flag='true';assert.deepEqual(await (await handler(req())).json(),{enabled:true});});
test.after(()=>delete globalThis.__status);
