import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import wallet from '../base44/functions/getMemberWallet/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('member wallet requires authentication and rejects identity overrides',async()=>{
 globalThis.__testClient={auth:{me:async()=>null}};assert.equal((await wallet(post({}))).status,401);
 globalThis.__testClient={auth:{me:async()=>({id:'member:1'})}};assert.equal((await wallet(post({user_reference:'other'}))).status,400);
 assert.equal((await wallet(new Request('https://test.invalid'))).status,405);
});
test('pre-cutover wallet uses member-scoped legacy reads without Linux calls',async()=>{
 globalThis.__testSecrets={};const reads=[];
 globalThis.__testClient={auth:{me:async()=>({id:'member:1',points_balance:30,loyalty_xp:10})},entities:{PointsTransaction:{filter:async(...args)=>{reads.push(args);return [{id:'point',amount:5}];}},XpTransaction:{filter:async(...args)=>{reads.push(args);return [{id:'xp',xp_amount:2}];}}}};
 const response=await wallet(post({}));assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data.source,'legacy');assert.equal(data.points_balance,'30');assert.equal(data.points[0].amount,'5');assert.ok(reads.every(args=>args[0].user_id==='member:1'&&args[1]==='-created_date'&&args[2]===100));
});
test('authoritative wallet preserves precise balances and never reads legacy history',async()=>{
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 globalThis.__testClient={auth:{me:async()=>({id:'member:1',points_balance:100,loyalty_xp:100})},entities:{PointsTransaction:{filter:async()=>{throw Error('legacy must not run');}}}};
 try{
  globalThis.fetch=async(url,init)=>{assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'member:1'}});return Response.json({ok:true,data:url.endsWith('/balance')?{points_balance:'9007199254740993',xp_balance:'10',version:'2'}:[{operation_uuid:randomUUID(),operation_type:'task_reward',status:'applied',applied_at:'2026-10-11T10:00:00.000Z',points_delta:'9007199254740993',xp_delta:'5'}]});};
  const r=await wallet(post({}));assert.equal(r.status,200);const d=(await r.json()).data;assert.equal(d.source,'linux');assert.equal(d.points_balance,'9007199254740993');assert.equal(d.points[0].amount,'9007199254740993');assert.equal(d.xp[0].xp_amount,'5');assert.equal(d.points[0].balance_after,null);
 }finally{globalThis.fetch=original;}
});
test('unavailable authoritative reads cannot return cached Base44 balances',async()=>{
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};globalThis.__testClient={auth:{me:async()=>({id:'member:1',points_balance:999})}};
 try{globalThis.fetch=async()=>Response.json({ok:false,error:'ledger_not_active'},{status:409});const r=await wallet(post({}));assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,error:'wallet_unavailable'});}finally{globalThis.fetch=original;}
});
