import test from 'node:test';
import assert from 'node:assert/strict';
import disconnect from '../base44/functions/disconnectService/entry.ts';
import {encryptToken} from '../base44/shared/oauth.ts';
test('disconnect blocks local use and removes every matching credential before remote revocation',async()=>{
 const prior={fetch:globalThis.fetch,client:globalThis.__testClient,secrets:globalThis.__testSecrets};const calls=[];
 try{
  const enc=await encryptToken('test-token','a'.repeat(64));
  globalThis.__testSecrets={X_CLIENT_ID:'id',X_CLIENT_SECRET:'secret',X_REDIRECT_URI:'https://example.com/callback',OAUTH_TOKEN_ENCRYPTION_KEY:'a'.repeat(64)};
  const credentials=['cred1','cred2'].map(id=>({id,encrypted_access_token:enc.ciphertext,access_token_iv:enc.iv,encrypted_refresh_token:'',refresh_token_iv:''}));
  globalThis.__testClient={auth:{me:async()=>({id:'member'})},asServiceRole:{entities:{
   ConnectedService:{filter:async q=>{assert.deepEqual(q,{user_id:'member',service:'x'});return [{id:'conn1'},{id:'conn2'}];},update:async(id,row)=>{assert.equal(row.status,'disconnected');calls.push(id);}},
   ConnectedServiceCredential:{filter:async q=>{assert.deepEqual(q,{user_id:'member',provider:'x'});return credentials;},update:async(id,row)=>{assert.equal(row.encrypted_access_token,'');assert.equal(row.encrypted_refresh_token,'');assert.ok(row.revoked_at);calls.push(id);}}
  }}};
  globalThis.fetch=async()=>{assert.deepEqual(calls.slice(0,4),['conn1','conn2','cred1','cred2']);calls.push('remote');throw Error('Provider unavailable');};
  const response=await disconnect(new Request('https://example.com/disconnect',{method:'POST',body:JSON.stringify({provider:'x'})}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(calls.filter(x=>x==='remote').length,2);
 }finally{globalThis.fetch=prior.fetch;globalThis.__testClient=prior.client;globalThis.__testSecrets=prior.secrets;}
});
test('disconnect never reports success or contacts provider when credential cleanup fails',async()=>{
 const prior={fetch:globalThis.fetch,client:globalThis.__testClient};let remote=0;
 try{
  globalThis.fetch=async()=>{remote++;return Response.json({});};
  globalThis.__testClient={auth:{me:async()=>({id:'member'})},asServiceRole:{entities:{
   ConnectedService:{filter:async()=>[{id:'conn'}],update:async()=>{}},
   ConnectedServiceCredential:{filter:async()=>[{id:'cred'}],update:async()=>{throw Error('private-database-detail');}}
  }}};
  const response=await disconnect(new Request('https://example.com/disconnect',{method:'POST',body:'{"provider":"youtube"}'}));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'disconnect_unavailable'});assert.equal(remote,0);
 }finally{globalThis.fetch=prior.fetch;globalThis.__testClient=prior.client;}
});
test('disconnect rejects non-POST and forged member fields before data writes',async()=>{
 assert.equal((await disconnect(new Request('https://example.com/disconnect'))).status,405);
 const prior=globalThis.__testClient;try{
  globalThis.__testClient={auth:{me:async()=>({id:'member'})}};
  const r=await disconnect(new Request('https://example.com/disconnect',{method:'POST',body:'{"provider":"x","user_id":"another-member"}'}));
  assert.equal(r.status,400);
 }finally{globalThis.__testClient=prior;}
});
