import test from 'node:test';
import assert from 'node:assert/strict';
import manage from '../base44/functions/manageGames/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('members cannot configure game rewards',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'member',role:'user'})}};
 assert.equal((await manage(post({action:'list'}))).status,403);
});
test('staff game configuration sends only server-derived actor and exact policy',async()=>{
 const original=globalThis.fetch;
 globalThis.__testClient={auth:{me:async()=>({id:'staff',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'admin',active:true}]}}}};
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 try{
  globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/games/policy'));assert.deepEqual(JSON.parse(init.body),{action:'list',actor:{role:'admin',user_reference:'staff'}});return Response.json({ok:true,data:[]});};
  assert.equal((await manage(post({action:'list'}))).status,200);
  assert.equal((await manage(post({action:'list',actor:{role:'admin',user_reference:'override'}}))).status,400);
 }finally{globalThis.fetch=original;}
});
