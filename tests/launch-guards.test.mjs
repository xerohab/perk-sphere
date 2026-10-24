import test from 'node:test';
import assert from 'node:assert/strict';
import wallet from '../base44/functions/getMemberWallet/entry.ts';
import rules from '../base44/functions/managePartnerRewardRules/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
function fixture(role='admin',{auditFailure=false}={}){
 const writes=[],audits=[];
 globalThis.__testSecrets={};
 globalThis.__testClient={auth:{me:async()=>({id:'staff-1',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:role,active:true}]},PartnerRewardRule:{list:async()=>[],create:async data=>{writes.push(data);return {id:'rule-1',...data};}},AuditLog:{create:async data=>{if(auditFailure)throw Error('audit offline');audits.push(data);return data;}}}}};
 return {writes,audits};
}
test('accepted signed legacy balances remain readable without changing stored values',async()=>{
 globalThis.__testSecrets={};const user={id:'member',points_balance:0,loyalty_xp:-3};
 globalThis.__testClient={auth:{me:async()=>user},entities:{PointsTransaction:{filter:async()=>[]},XpTransaction:{filter:async()=>[]}}};
 const response=await wallet(post({}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.source,'legacy');assert.equal(body.data.loyalty_xp,'-3');assert.equal(user.loyalty_xp,-3);
});
test('unsafe legacy balance values remain rejected',async()=>{
 globalThis.__testSecrets={};globalThis.__testClient={auth:{me:async()=>({id:'member',points_balance:0,loyalty_xp:0.5})},entities:{PointsTransaction:{filter:async()=>[]},XpTransaction:{filter:async()=>[]}}};assert.equal((await wallet(post({}))).status,503);
});
const modes={ACCOUNT_REGISTERED:'award',ACCOUNT_LINKED:'award',ACCOUNT_DISABLED:'invalidate',VIDEO_WATCH_PROGRESS:'award',STREAM_STARTED:'lifecycle',STREAM_VIEW_PROGRESS:'award',STREAM_ENDED:'lifecycle',PURCHASE_COMPLETED:'award',PURCHASE_REFUNDED:'reverse',CHARGEBACK_ISSUED:'reverse',SUBSCRIPTION_ACTIVATED:'award',SUBSCRIPTION_RENEWED:'award',SUBSCRIPTION_CANCELLED:'invalidate'};
const bodyFor=(type,mode)=>({action:'save',partner_id:'',event_type:type,mode,enabled:false,points:mode==='award'?10:0,xp:mode==='award'?5:0,daily_limit:1,cooldown_seconds:0,min_watch_seconds:60});
for(const [type,mode] of Object.entries(modes))test(type+' uses correct audited configuration and cannot enable issuance',async()=>{
 const f=fixture();const response=await rules(post(bodyFor(type,mode)));assert.equal(response.status,200);const body=await response.json();assert.equal(body.live_issuance_enabled,false);assert.equal(f.writes.length,1);assert.equal(f.writes[0].mode,mode);assert.equal(f.writes[0].updated_by,'staff-1');assert.equal(f.audits.length,2);if(mode!=='award'){assert.equal(f.writes[0].points,0);assert.equal(f.writes[0].xp,0);}
});
test('lifecycle and reversal event reward injection is denied before any writes',async()=>{
 for(const type of ['STREAM_STARTED','STREAM_ENDED','ACCOUNT_DISABLED','PURCHASE_REFUNDED','CHARGEBACK_ISSUED','SUBSCRIPTION_CANCELLED']){
  const f=fixture();const response=await rules(post({...bodyFor(type,modes[type]),points:10}));assert.equal(response.status,400);assert.equal(f.writes.length,0);assert.equal(f.audits.length,0);
 }
});
test('support and analyst roles cannot edit reward rules',async()=>{
 for(const role of ['support','analyst','rewards_manager']){const f=fixture(role);assert.equal((await rules(post(bodyFor('ACCOUNT_LINKED','award')))).status,403);assert.equal(f.writes.length,0);}
});
test('audit failure prevents a rule update',async()=>{
 const f=fixture('admin',{auditFailure:true});assert.equal((await rules(post(bodyFor('ACCOUNT_LINKED','award')))).status,500);assert.equal(f.writes.length,0);
});
test('rule identity overrides and unsupported methods are rejected',async()=>{
 const f=fixture();assert.equal((await rules(post({...bodyFor('ACCOUNT_LINKED','award'),actor:{user_reference:'other'}}))).status,400);assert.equal((await rules(new Request('https://test.invalid'))).status,405);assert.equal(f.writes.length,0);
});
test('authoritative wallet preserves a signed historical XP total and its opening history',async()=>{
 const original=globalThis.fetch;
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'offline-test'};
 globalThis.__testClient={auth:{me:async()=>({id:'member',loyalty_xp:-3})}};
 try{
  globalThis.fetch=async url=>Response.json({ok:true,data:url.endsWith('/balance')?{points_balance:'0',xp_balance:'-3',version:'0'}:[{operation_uuid:'11111111-1111-4111-8111-111111111111',operation_type:'opening_balance',status:'applied',applied_at:'2026-10-24T12:00:00.000Z',points_delta:'0',xp_delta:'-3'}]});
  const response=await wallet(post({}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.source,'linux');assert.equal(body.data.loyalty_xp,'-3');assert.equal(body.data.xp[0].xp_amount,'-3');
 }finally{globalThis.fetch=original;}
});
