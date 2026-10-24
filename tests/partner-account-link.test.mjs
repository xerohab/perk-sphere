import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/partnerAccountLink/entry.ts';
import {getPartnerState} from '../src/lib/partner-account-state.js';

const partner={id:'partner-local',integration_status:'active',linux_api_partner_id:'11111111-1111-4111-8111-111111111111'};
const connection={id:'saved',user_id:'member-current',service:'partner_partner-local',status:'connected',account_handle:'existing-account'};
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
function fixture() {
 const writes=[],connected=[{...connection}];
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test-key',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 globalThis.__testClient={auth:{me:async()=>({id:'member-current'})},asServiceRole:{entities:{
  PartnerAccountLink:{filter:async query=>{assert.equal(query.user_id,'member-current');return [];}},
  ConnectedService:{filter:async query=>{assert.equal(query.user_id,'member-current');return connected;},
   update:async(id,data)=>{writes.push({id,data});},create:async()=>{throw Error('must reuse existing connection');}},
  PartnerIntegration:{list:async()=>[partner]}
 }}};
 return {writes,connected};
}
const verified={ok:true,linked:true,status:'verified',link_uuid:'verified-link',partner_account_reference:'existing-account',verified_at:'2026-10-24T10:00:00.000Z'};

test('partner listing preserves saved connections during unavailable, malformed and negative verification',async()=>{
 const original=globalThis.fetch;
 try {
  for(const [body,status,expected] of [[{ok:false},503,'unavailable'],[{ok:true},200,'unavailable'],[{ok:true,linked:true},200,'unavailable'],[{ok:true,linked:false},200,'not_linked']]){
   const f=fixture();let calls=0;
   globalThis.fetch=async(url,init)=>{calls++;assert.ok(url.endsWith('/v1/partner-links/status'));assert.deepEqual(JSON.parse(init.body),{partner_uuid:partner.linux_api_partner_id,user_reference:'member-current'});return Response.json(body,{status});};
   const response=await handler(post({action:'listLinks',user_reference:'forged-member'}));
   assert.equal(response.status,200);const data=await response.json();
   assert.equal(data.verification[partner.id],expected);assert.equal(data.sync_unavailable,expected==='unavailable');
   assert.equal(data.connected[0].status,'connected');assert.equal(f.writes.length,0);assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original;}
});

test('verified partner stays connected even when the reward bridge is unavailable',async()=>{
 const original=globalThis.fetch,f=fixture();let claims=0;
 Object.assign(globalThis.__testSecrets,{PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED:'true'});
 try{
  globalThis.fetch=async url=>{
   if(url.endsWith('/v1/partner-links/status'))return Response.json(verified);
   assert.ok(url.endsWith('/v1/perk-sphere/partner-rewards/claim-link'));claims++;return Response.json({ok:false},{status:503});
  };
  const response=await handler(post({action:'listLinks'})),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.verification[partner.id],'verified');
  assert.equal(data.connected[0].status,'connected');assert.equal(claims,1);assert.equal(f.writes.length,1);
 }finally{globalThis.fetch=original;}
});

test('member connection states never turn an outage into a disconnect or a fresh ownership proof',()=>{
 for(const verification of [{},{[partner.id]:'unavailable'}]){
  const result=getPartnerState(partner,[],[connection],verification);
  assert.equal(result.state,'unavailable');assert.equal(result.conn.id,'saved');
  assert.equal(getPartnerState(partner,[],[],verification).state,'unavailable');
 }
 assert.equal(getPartnerState(partner,[],[connection],{[partner.id]:'verified'}).state,'connected');
 assert.equal(getPartnerState(partner,[],[connection],{[partner.id]:'not_linked'}).state,'unverified');
 assert.equal(getPartnerState(partner,[],[],{[partner.id]:'not_linked'}).state,'connect');
 assert.equal(getPartnerState({...partner,integration_status:'setup_required'},[],[]).state,'coming_soon');
 const pending=[{partner_integration_id:partner.id,status:'pending',expires_at:new Date(Date.now()+60000).toISOString()}];
 assert.equal(getPartnerState(partner,pending,[],{[partner.id]:'not_linked'}).state,'pending');
 assert.equal(getPartnerState(partner,[{...pending[0],expires_at:'2020-01-01'}],[],{[partner.id]:'not_linked'}).state,'expired');
});

test('unauthenticated partner listing has no bridge or entity activity',async()=>{
 const original=globalThis.fetch;globalThis.__testClient={auth:{me:async()=>null}};
 try{globalThis.fetch=()=>{throw Error('must not call');};assert.equal((await handler(post({action:'listLinks'}))).status,401);}
 finally{globalThis.fetch=original;}
});
