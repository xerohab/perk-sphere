import test from 'node:test';
import assert from 'node:assert/strict';
import {giftSourceCommand,projectGiftSourceResult} from '../base44/shared/giftSourceContract.ts';
import {createGiftSourceAdminHandler} from '../base44/shared/giftSourceAdminHandler.ts';
import {permissionsFor} from '../base44/shared/permissions.ts';
import entry from '../base44/functions/manageGiftNotificationSources/entry.ts';
const scope={mode:'sandbox',merchantReference:'MERCHANT',webhookReference:'HOOK'};
const source={...scope,state:'paused',credentialVersion:'v1',intakeActorReference:'intake',workerActorReference:'worker',eventTypes:['PAYMENT.CAPTURE.REFUNDED']};
const read={action:'read',source:scope},revise={action:'revise',expectedVersion:1,source};
const request=(body=read,headers={},suffix='')=>new Request('https://test.invalid/sources'+suffix,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-token',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
function fixture(patch={}){
 let calls=0;const env={PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED:'true'},identity={id:'OPERATOR',role:'admin'},permissions=[];
 const options={getClient:()=>({}),getSecret:n=>env[n],authorize:async(_,p)=>{permissions.push(p);return {user:{...identity}};},post:async(path,b)=>{calls++;assert.equal(path,'/v1/perk-sphere/gift-notifications/sources');assert.deepEqual(b.actor,{role:'admin',user_reference:'OPERATOR'});return {ok:true,data:{production_ready:false,data:b.action==='read'?{version:1,source,financial_clearance_verified:false}:{version:2,replayed:false,financial_clearance_verified:false}}};},...patch};
 return {handler:createGiftSourceAdminHandler(options),env,identity,permissions,calls:()=>calls};
}
test('source administration permissions are explicit and exclusive to super admin',()=>{
 for(const role of ['admin','rewards_manager','support','analyst','unknown'])assert.ok(!permissionsFor(role).some(p=>p.startsWith('gift_notification_sources:')));
 assert.ok(permissionsFor('super_admin').includes('gift_notification_sources:manage'));
});
test('source command excludes actor/credential injection and pins source fields',()=>{
 for(const value of [{...read,actor:{role:'admin'}},{...read,source:{...scope,token:'PRIVATE'}},{...revise,source:{...source,eventTypes:[...source.eventTypes,...source.eventTypes]}},{...revise,expectedVersion:100},{...revise,source:{...source,state:'verified'}}])assert.throws(()=>giftSourceCommand(value));
 const input=structuredClone(revise),command=giftSourceCommand(input);input.source.state='active';input.source.eventTypes.push('CUSTOMER.DISPUTE.CREATED');assert.equal(command.source.state,'paused');assert.equal(command.source.eventTypes.length,1);
});
test('read projections reject another source and never grant financial verification',()=>{
 const result={production_ready:false,data:{version:1,source,financial_clearance_verified:false}};
 assert.equal(projectGiftSourceResult(result,read).source.state,'paused');
 for(const bad of [{...result,production_ready:true},{...result,data:{...result.data,financial_clearance_verified:true}},{...result,data:{...result.data,source:{...source,merchantReference:'OTHER'}}},{...result,data:{version:0,source,financial_clearance_verified:false}}])assert.throws(()=>projectGiftSourceResult(bad,read));
});
test('gateway checks authentication and dedicated permission before inspecting request bodies',async()=>{
 const s=fixture({authorize:async()=>({error:Response.json({error:'PRIVATE'},{status:401})})}),r=await s.handler(request());
 assert.equal(r.status,401);assert.doesNotMatch(await r.text(),/PRIVATE/);assert.equal(s.calls(),0);
 const paused=fixture();paused.env.PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED='false';assert.equal((await paused.handler(request())).status,503);assert.equal(paused.calls(),0);
});
test('gateway rejects cookie-only, invalid MIME, encoded and query requests',async()=>{
 for(const [req,code] of [[request(read,{Authorization:''}),403],[request(read,{'Content-Type':'text/plain'}),415],[request(read,{'Content-Encoding':'gzip'}),415],[request(read,{},'?actor=other'),400]]){
  const s=fixture();assert.equal((await s.handler(req)).status,code);assert.equal(s.calls(),0);
 }
});
test('invalid JSON, malformed UTF8 and oversized bodies cannot reach Linux',async()=>{
 for(const [raw,status] of [['{"PRIVATE":',400],['x'.repeat(16385),413]]){
  const s=fixture(),r=await s.handler(request(raw));assert.equal(r.status,status);assert.equal(s.calls(),0);assert.doesNotMatch(await r.text(),/PRIVATE|SyntaxError|stack/);
 }
 const s=fixture(),req=new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-token'},body:new Uint8Array([0xc0,0xaf])});assert.equal((await s.handler(req)).status,400);assert.equal(s.calls(),0);
});
test('gateway reads and revisions use distinct permission checks and signed server actor',async()=>{
 for(const command of [read,revise]){
  const s=fixture(),r=await s.handler(request(command));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
  assert.ok(s.permissions.includes(command.action==='read'?'gift_notification_sources:read':'gift_notification_sources:manage'));
  assert.equal(s.calls(),1);const result=await r.json();assert.equal(result.production_ready,false);assert.equal(result.data.financial_clearance_verified,false);
 }
});
test('identity replacement or permission revocation before dispatch blocks mutation',async()=>{
 let n=0;const s=fixture({authorize:async()=>++n===1?{user:{id:'OPERATOR',role:'admin'}}:{user:{id:'OTHER',role:'admin'}}});
 assert.equal((await s.handler(request(revise))).status,403);assert.equal(s.calls(),0);
});
test('authority loss after mutation reports uncertainty and suppresses returned metadata',async()=>{
 let n=0;const s=fixture({authorize:async()=>++n<3?{user:{id:'OPERATOR',role:'admin'}}:{error:Response.json({},{status:403})}});
 const r=await s.handler(request(revise));assert.equal(r.status,409);assert.equal((await r.json()).reconcile_required,true);assert.equal(s.calls(),1);
});
test('only recognized revision conflicts are actionable; unverified success is unconfirmed',async()=>{
 for(const [result,error] of [[{ok:false,status:409,code:'source_revision_conflict'},'source_revision_conflict'],[{ok:false,status:500,code:'PRIVATE_SQL'},'source_update_unconfirmed'],[{ok:true,data:{production_ready:true,data:{version:2,replayed:false,financial_clearance_verified:false}}},'source_update_unconfirmed']]){
  const s=fixture({post:async()=>result}),r=await s.handler(request(revise));assert.equal(r.status,409);assert.equal((await r.json()).error,error);
 }
});
test('actual function retains Linux envelope and leaves existing callers unmodified',async()=>{
 const original=globalThis.fetch;
 globalThis.__testSecrets={PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic'};
 globalThis.__testClient={auth:{me:async()=>({id:'OPERATOR',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:'super_admin'}]}}}};
 globalThis.fetch=async()=>Response.json({ok:true,production_ready:false,data:{version:1,source,financial_clearance_verified:false}});
 try{assert.equal((await entry(request(read))).status,200);}finally{globalThis.fetch=original;delete globalThis.__testSecrets;delete globalThis.__testClient;}
});
