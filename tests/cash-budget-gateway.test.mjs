import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/manageCashBudget/entry.ts';
const originalFetch=globalThis.fetch;
const post=b=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)});
const read={action:'read',limit:10,offset:0},update={action:'update',expected_version:2,enabled:true,approved_limit_pence:'10000',reserve_reference:'reserve-ref',reason:'Synthetic approval test'};
function fixture(role='super_admin'){
 globalThis.__testSecrets={PERKSPHERE_CASH_BUDGET_ADMIN_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'synthetic',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic'};
 globalThis.__testClient={auth:{me:async()=>({id:'STAFF',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}};
 const before={enabled:false,version:1,approved_limit_pence:'5000',allocated_pence:'0',reserve_reference:'reserve-ref'};
 const after={...before,enabled:true,version:2};
 const data={configured:true,currency:'GBP',budget:{...after,allocated_pence:'1000'},remaining_pence:'4000',history:[{audit_uuid:'00000000-0000-4000-8000-000000000001',actor_reference:'STAFF',reason:'Synthetic reason',before,after,created_at:'2026-10-31T00:00:00.000Z',private_payload:'PRIVATE'}],limit:10,offset:0,has_more:false,provider_funding_verified:false,member_gate_changed:false,payout_sent:false,private_payload:'PRIVATE'};
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://api.perksphere.org/v1/perk-sphere/cash-budget-admin');const b=JSON.parse(options.body);assert.deepEqual(b.actor,{role:'admin',user_reference:'STAFF'});return Response.json({ok:true,data});};return data;
}
test('budget gateway stays paused before authentication and requires management permission even to read',async()=>{
 fixture();delete globalThis.__testSecrets.PERKSPHERE_CASH_BUDGET_ADMIN_ENABLED;globalThis.__testClient.auth.me=()=>{throw Error('MUST_NOT_AUTH');};assert.equal((await handler(post(read))).status,503);
 fixture('analyst');assert.equal((await handler(post(read))).status,403);
 fixture();globalThis.__testClient.auth.me=async()=>null;assert.equal((await handler(post(read))).status,401);
});
test('budget gateway never accepts actor overrides, floating money, oversized amounts or enabled initial budgets',async()=>{
 fixture();globalThis.fetch=()=>{throw Error('MUST_NOT_CALL');};
 for(const b of [{...read,actor:{role:'admin'}},{...read,offset:10001},{...update,approved_limit_pence:10000},{...update,approved_limit_pence:'18446744073709551616'},{...update,approved_limit_pence:'1.5'},{...update,expected_version:0},{...update,reason:''}])assert.equal((await handler(post(b))).status,400);
});
test('budget gateway projects bounded audit records and never upgrades an approval to funding verification',async()=>{
 fixture();const r=await handler(post(read));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const text=await r.text();assert.doesNotMatch(text,/PRIVATE|private_payload/);assert.equal(JSON.parse(text).data.provider_funding_verified,false);
});
test('budget gateway rejects inconsistent totals, audit history and provider verification assertions',async()=>{
 for(const change of [d=>d.provider_funding_verified=true,d=>d.remaining_pence='4001',d=>d.budget.allocated_pence='6000',d=>d.history[0].after.version=3,d=>d.history[0].after.allocated_pence='1',d=>d.history.push(d.history[0]),d=>d.offset=1]){
  const d=fixture();change(d);assert.equal((await handler(post(read))).status,503);
 }
});
test('budget update must match exact submitted ceiling/reference and committed revision',async()=>{
 const d=fixture();Object.assign(d,{updated:true,budget:{enabled:true,version:3,approved_limit_pence:'10000',allocated_pence:'1000',reserve_reference:'reserve-ref'}});
 let r=await handler(post(update));assert.equal(r.status,200);assert.equal((await r.json()).data.member_gate_changed,false);
 d.budget.approved_limit_pence='10001';assert.equal((await handler(post(update))).status,503);
});
test('budget conflicts are actionable and private failures stay generic',async()=>{
 fixture();globalThis.fetch=async()=>Response.json({ok:false,error:'CASH_BUDGET_BELOW_LIABILITY'},{status:409});const r=await handler(post(update));assert.equal(r.status,409);assert.equal((await r.json()).error,'CASH_BUDGET_BELOW_LIABILITY');
 fixture();globalThis.fetch=async()=>{throw Error('PRIVATE_SQL');};const fail=await handler(post(read));assert.equal(fail.status,503);assert.doesNotMatch(await fail.text(),/PRIVATE_SQL/);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
