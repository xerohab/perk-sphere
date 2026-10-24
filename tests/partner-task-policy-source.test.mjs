import test from 'node:test';
import assert from 'node:assert/strict';
import {readPartnerTaskPolicy} from '../base44/shared/partnerTaskPolicy.ts';
const partnerUuid='630feee8-2649-4c4f-b2a0-c26746a696fd',taskReference='6add18607277b6ca86efab43';
function fixture(){
 const task={id:taskReference,partner_integration_id:'partner-local',destination_id:'destination-local',destination_type:'website',task_type:'watch_video',content_id:'6adb90722e172992337a1b43',reward_processing:'linux_partner',completion_limit_type:'once_ever',active:true,publicly_visible:true,points_reward:10,xp_reward:20,required_seconds:300,required_percentage:0,content_duration_seconds:4839,content_duration_source:'operator_media_probe',content_duration_verified_at:'2026-10-24T20:50:07.784Z',content_media_url_sha256:'a'.repeat(64),private_note:'DO NOT RETURN'};
 const partner={linux_api_partner_id:partnerUuid,active:true,integration_status:'active'};
 const destination={domain:'xerostreams.com',status:'active',eligibility:'allowed',publicly_visible:true,points_eligible:true,xp_eligible:true};
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_PARTNER_TASKS_ENABLED:'true'};
 const admin={entities:{Task:{get:async id=>{assert.equal(id,taskReference);return task;}},PartnerIntegration:{get:async()=>partner},Website:{get:async()=>destination}}};
 return {admin,task,partner,destination};
}
test('signed-source task policy is derived only from stored approved task/partner/destination data',async()=>{
 const f=fixture(),data=await readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid});
 assert.equal(data.enabled,true);assert.equal(data.kind,'native_video');assert.equal(data.points,10);assert.equal(data.xp,20);assert.equal(data.required_seconds,300);assert.match(data.policy_digest,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(data).includes('DO NOT RETURN'),false);
 f.task.points_reward=20;const revised=await readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid});assert.notEqual(revised.policy_digest,data.policy_digest);
});
test('paused source, drafts, paused partner and disallowed or ineligible destinations cannot enable a task',async()=>{
 for(const change of ['source','authority','draft','private','partner','disallowed','points','xp']){
  const f=fixture();
  if(change==='source')delete globalThis.__testSecrets.PERKSPHERE_PARTNER_TASKS_ENABLED;
  if(change==='authority')delete globalThis.__testSecrets.PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE;
  if(change==='draft')f.task.active=false;
  if(change==='private')f.task.publicly_visible=false;
  if(change==='partner')f.partner.active=false;
  if(change==='disallowed')f.destination.eligibility='disallowed';
  if(change==='points')f.destination.points_eligible=false;
  if(change==='xp')f.destination.xp_eligible=false;
  assert.equal((await readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid})).enabled,false,change);
 }
});
test('unverified durations, unsupported requirements and mismatched partners cannot become task policies',async()=>{
 for(const change of [{content_duration_seconds:0},{content_media_url_sha256:'bad'},{required_percentage:50},{require_continuous:true},{task_type:'live_stream'},{points_reward:0.5},{completion_limit_type:'unlimited'}]){
  const f=fixture();Object.assign(f.task,change);await assert.rejects(readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid}));
 }
 const f=fixture();await assert.rejects(readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid:'other-partner'}));f.partner.linux_api_partner_id='other';await assert.rejects(readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid}));
});
test('Premium policy is distinct from generic purchase or self-reported activity',async()=>{
 const f=fixture();Object.assign(f.task,{task_type:'complete_activity',content_id:'xero-premium-upgrade-v1',points_reward:100,xp_reward:200});
 const data=await readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid});assert.equal(data.kind,'premium');assert.equal(data.required_seconds,0);assert.equal(data.full_content,false);assert.equal(data.media_url_sha256,null);
 f.task.content_id='donation';await assert.rejects(readPartnerTaskPolicy(f.admin,{taskReference,partnerUuid}));
});
