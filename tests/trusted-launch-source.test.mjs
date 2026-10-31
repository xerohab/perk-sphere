import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import source from '../base44/functions/trustedLaunchSource/entry.ts';
const secret='test-only-launch-key';
function request(body,path='/functions/trustedLaunchSource'){
 const raw=JSON.stringify(body),time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),signature=createHmac('sha256',secret).update(['POST',path,time,nonce,createHash('sha256').update(raw).digest('hex')].join('\n')).digest('hex');
 return new Request('https://example.com/function',{method:'POST',body:raw,headers:{'X-PS-Key-ID':'test','X-PS-Timestamp':time,'X-PS-Nonce':nonce,'X-PS-Signature':signature}});
}
function fixture(){
 globalThis.__testSecrets={PERKSPHERE_LINUX_INBOUND_KEY_ID:'test',PERKSPHERE_LINUX_INBOUND_HMAC_SECRET:secret};
 globalThis.__testClient={asServiceRole:{entities:{
  TrustedApiNonce:{filter:async()=>[],create:async()=>({id:'nonce'})},
  Setting:{filter:async()=>[]},
  User:{get:async()=>({id:'member',created_date:new Date().toISOString(),points_balance:0,loyalty_xp:0})},
  Restriction:{filter:async()=>[]}
 }}};
}
test('launch source uses its own signed path and never returns credential values',async()=>{
 fixture();
 const bad=await source(request({action:'launch_readiness'},'/functions/trustedBrowserConfig'));assert.notEqual(bad.status,200);
 const good=await source(request({action:'launch_readiness'}));assert.equal(good.status,200);
 const body=await good.json();assert.equal(body.data.source_revision,'launch-source-v1');assert.equal(body.data.wallet_authoritative,false);
 assert.equal(JSON.stringify(body).includes(secret),false);assert.equal(good.headers.get('Cache-Control'),'no-store');
 assert.equal((await source(request({action:'launch_readiness',user_reference:'member'}))).status,400);
});
test('launch eligibility and enrollment stay paused until their exact gates are enabled',async()=>{
 fixture();
 assert.equal((await(await source(request({action:'game_eligibility',user_reference:'member'}))).json()).data.eligible,false);
 globalThis.__testSecrets.PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE='true';
 assert.equal((await(await source(request({action:'game_eligibility',user_reference:'member'}))).json()).data.eligible,true);
 assert.equal((await(await source(request({action:'wallet_enrollment',user_reference:'member'}))).json()).data.eligible,false);
 globalThis.__testSecrets.PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED='true';
 assert.equal((await(await source(request({action:'wallet_enrollment',user_reference:'member'}))).json()).data.eligible,true);
 globalThis.__testClient.asServiceRole.entities.Restriction.filter=async()=>[{active:true,type:'points_earning_paused'}];
 assert.equal((await(await source(request({action:'game_eligibility',user_reference:'member'}))).json()).data.eligible,false);
});
test('signed cash eligibility has its own gates, binds financial action and returns no member profile',async()=>{
 fixture();
 const body={action:'cash_eligibility',user_reference:'member',operation:'convert'};
 let response=await source(request(body));assert.equal(response.status,200);assert.equal((await response.json()).data.eligible,false);
 Object.assign(globalThis.__testSecrets,{PERKSPHERE_CASH_SOURCE_ENABLED:'true',PERKSPHERE_CASH_MEMBER_ENABLED:'true',PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'});
 response=await source(request(body));assert.deepEqual((await response.json()).data,{user_reference:'member',operation:'convert',eligible:true});
 globalThis.__testClient.asServiceRole.entities.Restriction.filter=async()=>[{user_id:'member',type:'redemption_disabled',active:true}];
 assert.equal((await(await source(request(body))).json()).data.eligible,false);
 assert.equal((await source(request({...body,eligible:true}))).status,400);
 assert.notEqual((await source(request(body,'/functions/trustedBrowserConfig'))).status,200);
});
test('launch source rejects unknown operations and never accepts browser reward evidence',async()=>{
 fixture();
 for(const body of [{action:'award',points:100},{action:'game_eligibility',user_reference:'member',eligible:true},{action:'social_link_evidence',user_reference:'member',provider:'x',account_reference:'123'}])assert.equal((await source(request(body))).status,400);
});
