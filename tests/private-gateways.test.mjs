import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import reports from '../base44/functions/perkSphereReports/entry.ts';
import requests from '../base44/functions/perkSphereRequests/entry.ts';
import rewards from '../base44/functions/perkSphereRewardReview/entry.ts';
const originalFetch=globalThis.fetch;
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const member={id:'MEMBER',role:'user'};
const setClient=(user=member,role='support')=>{globalThis.__testClient={auth:{me:async()=>user},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}};};
const entries=[
 ['reports',reports,{action:'archives'},{action:'adminArchives'}],
 ['requests',requests,{action:'list'},{action:'listAll'}],
 ['rewards',rewards,{action:'mine'},{action:'reviewQueue'}]
];
for(const [name,handler,read,privileged] of entries){
 test(name+' gateway requires authenticated POST and rejects malformed JSON',async()=>{
  setClient(null);
  let response=await handler(post(read));assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');
  response=await handler(new Request('https://test.invalid'));assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'POST');
  setClient();
  for(const body of [null,[],42]){response=await handler(post(body));assert.equal(response.status,400);assert.equal(response.headers.get('Cache-Control'),'no-store');}
 });
 test(name+' member operation keeps an admin account in member scope',async()=>{
  setClient({...member,role:'admin'});globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic test secret'};
  globalThis.fetch=async(url,init)=>{assert.deepEqual(JSON.parse(init.body).actor,{user_reference:'MEMBER',role:'member'});return Response.json({ok:true,data:[]});};
  const response=await handler(post(read));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 });
 test(name+' privileged read requires a staff permission',async()=>{
  setClient();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
  assert.equal((await handler(post(privileged))).status,403);assert.equal(calls,0);
 });
 test(name+' unexpected staff lookup failure cannot disclose diagnostics',async()=>{
  setClient({...member,role:'admin'});
  globalThis.__testClient.asServiceRole.entities.StaffMember.filter=async()=>{throw Error('private diagnostic fixture');};
  const response=await handler(post(privileged));assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.doesNotMatch(await response.text(),/private diagnostic fixture/);
 });
}
test('review reasons with unexpected types fail as input errors',async()=>{
 setClient();
 assert.equal((await requests(post({action:'review',requestId:'id',decision:'approved',reason:123}))).status,400);
 assert.equal((await rewards(post({action:'decision',requestId:'id',decision:'approved',reason:{}}))).status,400);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
