import test from 'node:test';
import assert from 'node:assert/strict';
import manage from '../base44/functions/partnerRewardPolicy/entry.ts';
const request=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('members and staff without rule permissions cannot change Linux policies',async()=>{
 for(const user of [null,{id:'member',role:'user'},{id:'staff',role:'admin'}]){
  globalThis.__testClient={auth:{me:async()=>user},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'support',active:true}]}}}};
  const result=await manage(request({action:'update'}));assert.ok([401,403].includes(result.status));
 }
});
test('policy bridge rejects caller identity and derives the staff actor',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'staff',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'admin',active:true}]}}}};
 assert.equal((await manage(request({action:'list',actor:{role:'admin',user_reference:'other'}}))).status,400);
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 try{globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/v1/perk-sphere/partner-rewards/policy'));assert.deepEqual(JSON.parse(init.body),{action:'list',actor:{role:'admin',user_reference:'staff'}});return Response.json({ok:true,data:[]});};
 assert.equal((await manage(request({action:'list'}))).status,200);
 }finally{globalThis.fetch=original;}
});
