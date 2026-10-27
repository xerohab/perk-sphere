import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
let code=await readFile(new URL('../base44/functions/claimDailyLogin/entry.ts',import.meta.url),'utf8');
for(const [line,replacement] of [
 ["import {ensureLinuxWallet} from '../../shared/memberWalletEnrollment.ts';","const ensureLinuxWallet=globalThis.__daily.ensure;"],
 ["import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';","const createClientFromRequest=globalThis.__daily.client;"],
 ["import {linuxTrustedPost} from '../../shared/linuxClient.ts';","const linuxTrustedPost=globalThis.__daily.post;"],
 ["import {assertAccountEligible} from '../../shared/rewardPolicy.ts';","const assertAccountEligible=globalThis.__daily.eligible;"],
 ["import {secrets} from 'base44:runtime';","const secrets=globalThis.__daily.secrets;"]
]){if(!code.includes(line))throw Error('fixture mismatch');code=code.replace(line,replacement);}
let user=null,enabled=false,calls=[];globalThis.__daily={ensure:async id=>calls.push(['ensure',id]),client:()=>({auth:{me:async()=>user},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}}),post:async(path,body)=>{calls.push(['post',path,body]);return {ok:true,data:{enabled:true,day:'2026-10-27',points:1,duplicate:false}};},eligible:()=>{},secrets:{get:()=>enabled?'true':'false'}};
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from((await transform(code,{loader:'ts',format:'esm'})).code).toString('base64'));
const request=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('paused and unauthenticated requests cannot award',async()=>{calls=[];enabled=false;assert.equal((await handler(request({}))).status,503);enabled=true;user=null;assert.equal((await handler(request({}))).status,401);assert.equal(calls.length,0);});
test('member identity is server-derived and caller cannot supply reward data',async()=>{calls=[];user={id:'MEMBER'};assert.equal((await handler(request({points:99}))).status,400);const r=await handler(request({}));assert.equal(r.status,200);assert.deepEqual(calls[1],['post','/v1/perk-sphere/daily-login',{actor:{role:'member',user_reference:'MEMBER'}}]);assert.deepEqual(await r.json(),{data:{day:'2026-10-27',points:1,duplicate:false}});});
test.after(()=>delete globalThis.__daily);
