import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {memberRequest,adminRequest,linuxResponse,PERK_SPHERE_ENDPOINTS as E} from '../base44/shared/perkSphereClient.ts';
const originalFetch=globalThis.fetch;
const account={id:'STAFF-MEMBER',role:'admin',account_status:'active'};
const sdk=(role='support')=>({auth:{me:async()=>account},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}});
const setup=()=>{globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic-key',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic test secret'};};
test('member-safe operations never inherit an admin actor or browser identity',async()=>{
 setup();const sent=[];globalThis.fetch=async(url,init)=>{sent.push({url:String(url),body:JSON.parse(init.body)});return Response.json({ok:true,data:[]});};
 for(const path of [E.DIRECTORY_LIST,E.REQUESTS_LIST,E.QUIZZES_LIST,E.QUIZZES_QUESTIONS,E.GRADING_SUBMIT,E.GRADING_HISTORY,E.REPORTS_PREVIEW,E.REPORTS_ARCHIVES,E.REPORTS_DETAIL,E.REWARD_REVIEW_MINE]){
  const result=await memberRequest(sdk(),path,{actor:{role:'admin',user_reference:'OTHER'},quizId:'quiz',filters:{}});
  assert.equal(result.ok,true);assert.deepEqual(sent.at(-1).body.actor,{user_reference:account.id,role:'member'});
 }
});
test('privileged APIs remain unreachable through member requests even for an admin account',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 for(const path of [E.QUIZZES_CREATE,E.QUIZZES_PUBLISH,E.DIRECTORY_UPSERT,E.REQUESTS_REVIEW,E.REWARD_REVIEW_QUEUE,E.REWARD_REVIEW_DECISION,E.REPORTS_ARCHIVE]){
  assert.equal((await memberRequest(sdk('super_admin'),path,{})).status,403);
 }assert.equal(calls,0);
});
test('staff permission checks preserve legitimate admin access and block limited roles',async()=>{
 setup();let calls=0;globalThis.fetch=async(url,init)=>{calls++;assert.deepEqual(JSON.parse(init.body).actor,{user_reference:account.id,role:'admin'});return Response.json({ok:true,data:[]});};
 assert.equal((await adminRequest(sdk('support'),E.QUIZZES_PUBLISH,{quizId:'quiz'},'tasks.publish')).status,403);
 assert.equal(calls,0);
 assert.equal((await adminRequest(sdk('rewards_manager'),E.QUIZZES_PUBLISH,{quizId:'quiz'},'tasks.publish')).ok,true);
 assert.equal(calls,1);
 const noStaff=sdk();noStaff.asServiceRole.entities.StaffMember.filter=async()=>[];
 assert.equal((await adminRequest(noStaff,E.REQUESTS_LIST,{},'destinations.manage')).status,403);assert.equal(calls,1);
});
test('suspended accounts cannot use member or administrative API paths',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 const restricted=sdk('super_admin');restricted.auth.me=async()=>({...account,account_status:'suspended'});
 assert.equal((await memberRequest(restricted,E.REQUESTS_LIST,{})).status,403);
 assert.equal((await adminRequest(restricted,E.REQUESTS_LIST,{},'destinations.manage')).status,403);assert.equal(calls,0);
});
test('shared API envelopes keep successful and failed personal responses out of caches',async()=>{
 for(const result of [{ok:true,data:{entries:[]}},{ok:false,status:403,code:'forbidden',error:'Forbidden'}]){
  const response=linuxResponse(result);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.status,result.ok?200:403);
 }
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testSecrets;});
