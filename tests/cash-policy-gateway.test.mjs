import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/manageCashConversionPolicy/entry.ts';
const originalFetch=globalThis.fetch;
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const update={action:'update',expected_version:0,enabled:false,input_points:100,output_pence:20,reason:'Synthetic cash policy test'};
function fixture(role='super_admin'){
 globalThis.__testSecrets={PERKSPHERE_CASH_POLICY_ADMIN_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'synthetic',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic'};
 globalThis.__testClient={auth:{me:async()=>({id:'STAFF',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}};
 const response={configured:true,enabled:false,version:1,input_points:100,output_pence:20,currency:'GBP',private_detail:'PRIVATE'};
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://api.perksphere.org/v1/perk-sphere/cash-admin');const b=JSON.parse(options.body);assert.deepEqual(b.actor,{role:'admin',user_reference:'STAFF'});return Response.json({ok:true,data:response});};return response;
}
test('cash policy gateway stays paused before authentication or Linux access',async()=>{
 fixture();delete globalThis.__testSecrets.PERKSPHERE_CASH_POLICY_ADMIN_ENABLED;globalThis.__testClient.auth.me=()=>{throw Error('MUST_NOT_AUTH');};
 const r=await handler(post({action:'read'}));assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('cash policy reads require staff view permission; writes require management permission',async()=>{
 fixture('analyst');assert.equal((await handler(post({action:'read'}))).status,200);assert.equal((await handler(post(update))).status,403);
 fixture();globalThis.__testClient.auth.me=async()=>null;assert.equal((await handler(post({action:'read'}))).status,401);
});
test('cash gateway rejects actor overrides, enabled first rates and absent reasons',async()=>{
 fixture();globalThis.fetch=()=>{throw Error('MUST_NOT_CALL');};
 for(const body of [{...update,actor:{role:'admin'}},{...update,enabled:true},{...update,reason:''},{...update,input_points:1.5}])assert.equal((await handler(post(body))).status,400);
});
test('cash gateway projects policy metadata and binds exact committed revision',async()=>{
 let d=fixture();let r=await handler(post({action:'read'}));assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/PRIVATE|private_detail/);
 d=fixture();Object.assign(d,{updated:true,policy:{enabled:false,version:1,input_points:'100',output_pence:'20'},member_gate_changed:false,payout_sent:false});r=await handler(post(update));assert.equal(r.status,200);assert.equal((await r.json()).data.member_gate_changed,false);
 d.policy.output_pence='200';assert.equal((await handler(post(update))).status,503);
});
test('cash gateway fails closed on unsafe policy metadata and preserves conflict status',async()=>{
 const d=fixture();d.output_pence=0;assert.equal((await handler(post({action:'read'}))).status,503);
 fixture();globalThis.fetch=async()=>Response.json({ok:false,error:'CASH_POLICY_CONFLICT'},{status:409});assert.equal((await handler(post(update))).status,409);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
