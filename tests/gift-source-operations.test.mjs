import test from 'node:test';
import assert from 'node:assert/strict';
import {giftSourceCommand,projectGiftSourceResult} from '../base44/shared/giftSourceContract.ts';
import {createGiftSourceAdminHandler} from '../base44/shared/giftSourceAdminHandler.ts';
const source={mode:'sandbox',merchantReference:'MERCHANT',webhookReference:'HOOK'},command={action:'operations',source};
function report(){
 return {source,readOnly:true,schemaAvailable:true,scopeIntegrityChecked:true,counts:{total:'1',pending:'1',processing:'0',retry:'0',processed:'0',dead:'0',unknownStates:'0',expiredLeases:'0',overdueUnresolved:'0',integrityMismatches:'0'},issues:[],cases:[{notificationHash:'a'.repeat(64),state:'pending',version:1,attempts:0,availableAt:'2026-11-10T00:00:00.000Z',leaseUntil:null,leaseExpired:false,recoveryAction:'await_worker',leaseToken:'PRIVATE'}],hasMoreCases:false,workerRunningVerified:false,providerCalls:0,financial_clearance_verified:false,production_ready:false,privatePayload:'PRIVATE'};
}
const envelope=data=>({production_ready:false,data});
test('operations command accepts only exact source scope and cannot request retries or actor overrides',()=>{
 assert.deepEqual(giftSourceCommand(command),command);
 for(const b of [{...command,actor:'OTHER'},{...command,retry:true},{...command,source:{...source,notificationHash:'a'.repeat(64)}}])assert.throws(()=>giftSourceCommand(b));
});
test('operations projection strips private fields and binds the exact requested source',()=>{
 const data=projectGiftSourceResult(envelope(report()),command);assert.equal(data.cases[0].state,'pending');assert.doesNotMatch(JSON.stringify(data),/PRIVATE|leaseToken|privatePayload/);
 const foreign=report();foreign.source={...source,mode:'live'};assert.throws(()=>projectGiftSourceResult(envelope(foreign),command));
});
test('operations projection rejects fabricated uptime, incomplete counts and unsafe recovery advice',()=>{
 for(const mutate of [r=>r.workerRunningVerified=true,r=>r.providerCalls=1,r=>r.counts.total='2',r=>r.counts.expiredLeases='1',r=>r.cases[0].recoveryAction='retry_now',r=>r.cases.push(r.cases[0]),r=>r.scopeIntegrityChecked=false,r=>r.cases[0].leaseUntil='2026-11-10T01:00:00.000Z']){
  const r=report();mutate(r);assert.throws(()=>projectGiftSourceResult(envelope(r),command));
 }
});
test('unavailable schema and over-capacity snapshots cannot display a healthy recovery list',()=>{
 const r={...report(),schemaAvailable:false,scopeIntegrityChecked:false,counts:null,issues:['notification_schema_unavailable'],cases:[]};assert.equal(projectGiftSourceResult(envelope(r),command).schemaAvailable,false);
 r.cases=report().cases;assert.throws(()=>projectGiftSourceResult(envelope(r),command));
 const large=report();Object.assign(large,{scopeIntegrityChecked:false,issues:['capacity_review_required'],cases:[]});Object.assign(large.counts,{total:'1001',pending:'1001',integrityMismatches:null});assert.equal(projectGiftSourceResult(envelope(large),command).counts.total,'1001');
});
test('gateway operations require read permission and reauthorize after a slow inspection',async()=>{
 const permissions=[];let checks=0;
 const handler=createGiftSourceAdminHandler({getClient:()=>({}),getSecret:()=> 'true',authorize:async(_,p)=>{permissions.push(p);checks++;return {user:{id:'OPERATOR',role:'admin'}};},post:async(_,b)=>{assert.equal(b.action,'operations');assert.equal(b.actor.user_reference,'OPERATOR');return {ok:true,data:envelope(report())};}});
 const req=()=>new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-token'},body:JSON.stringify(command)});
 assert.equal((await handler(req())).status,200);assert.ok(permissions.every(p=>p==='gift_notification_sources:read'));assert.ok(checks>=3);
 let allowed=true;const denied=createGiftSourceAdminHandler({getClient:()=>({}),getSecret:()=> 'true',authorize:async()=>allowed?{user:{id:'OPERATOR',role:'admin'}}:{error:Response.json({},{status:403})},post:async()=>{allowed=false;return {ok:true,data:envelope(report())};}});
 const r=await denied(req());assert.equal(r.status,503);assert.equal((await r.json()).error,'gift_source_admin_unavailable');
});
