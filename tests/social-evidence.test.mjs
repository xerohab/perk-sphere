import test from 'node:test';
import assert from 'node:assert/strict';
import {socialLinkEvidence} from '../base44/shared/socialEvidence.ts';
import {encryptToken} from '../base44/shared/oauth.ts';
const now=Date.now(),key='a'.repeat(64);
async function fixture(){
 const encrypted=await encryptToken('test-token',key);
 const connection={id:'connection',user_id:'member',service:'x',status:'connected',provider_user_id:'12345',external_account_id:'12345'};
 const credential={id:'credential',user_id:'member',provider:'x',connected_service_id:'connection',provider_user_id:'12345',encrypted_access_token:encrypted.ciphertext,access_token_iv:encrypted.iv,token_expiry:new Date(now+60000).toISOString()};
 let conns=[connection],creds=[credential],restrictions=[];
 const admin={entities:{
  ConnectedService:{filter:async()=>structuredClone(conns)},
  ConnectedServiceCredential:{filter:async()=>structuredClone(creds)},
  User:{get:async()=>({id:'member',account_status:'active'})},Restriction:{filter:async()=>restrictions}
 }};
 const values={PERKSPHERE_SOCIAL_LINK_SOURCE_ENABLED:'true',PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',OAUTH_TOKEN_ENCRYPTION_KEY:key};
 const deps={clock:()=>now,getSecret:k=>values[k],identityLookup:async token=>{assert.equal(token,'test-token');return {provider_user_id:'12345'};}};
 return {admin,deps,connection,credential,values,setConns:x=>conns=x,setCreds:x=>creds=x,setRestrictions:x=>restrictions=x};
}
const input={provider:'x',userReference:'member'};
test('social evidence uses fresh provider identity and returns no tokens or profile data',async()=>{
 const f=await fixture();const proof=await socialLinkEvidence(f.admin,input,f.deps);
 assert.deepEqual(Object.keys(proof).sort(),['account_reference','connection_reference','credential_reference','eligible','proof_version','provider','user_reference','verified_at'].sort());
 assert.equal(proof.account_reference,'12345');assert.equal(JSON.stringify(proof).includes('test-token'),false);
});
test('social evidence is unavailable with either launch authority or source gate off',async()=>{
 for(const gate of ['PERKSPHERE_SOCIAL_LINK_SOURCE_ENABLED','PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE']){
  const f=await fixture();f.values[gate]='false';await assert.rejects(socialLinkEvidence(f.admin,input,f.deps),/disabled/);
 }
});
test('expired, duplicate, revoked or mismatched stored credentials never establish ownership',async()=>{
 for(const change of [{token_expiry:'invalid'},{token_expiry:new Date(now).toISOString()},{revoked_at:new Date(now).toISOString()},{provider_user_id:'999'},{connected_service_id:'other'}]){
  const f=await fixture();Object.assign(f.credential,change);await assert.rejects(socialLinkEvidence(f.admin,input,f.deps),/unavailable/);
 }
 const f=await fixture();f.setConns([f.connection,f.connection]);await assert.rejects(socialLinkEvidence(f.admin,input,f.deps),/unavailable/);
});
test('provider mismatch, current earning restriction or disconnect during provider I/O prevents evidence',async()=>{
 const mismatch=await fixture();mismatch.deps.identityLookup=async()=>({provider_user_id:'987'});await assert.rejects(socialLinkEvidence(mismatch.admin,input,mismatch.deps),/mismatch/);
 const restricted=await fixture();restricted.setRestrictions([{active:true,type:'points_earning_paused'}]);await assert.rejects(socialLinkEvidence(restricted.admin,input,restricted.deps),/restriction/);
 const disconnected=await fixture();disconnected.deps.identityLookup=async()=>{disconnected.connection.status='disconnected';return {provider_user_id:'12345'};};await assert.rejects(socialLinkEvidence(disconnected.admin,input,disconnected.deps),/unavailable/);
});
test('credential replacement during provider lookup cannot authorize the old identity',async()=>{
 const f=await fixture();f.deps.identityLookup=async()=>{f.credential.id='new-credential';return {provider_user_id:'12345'};};await assert.rejects(socialLinkEvidence(f.admin,input,f.deps),/changed/);
});
