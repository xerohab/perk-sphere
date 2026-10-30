import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import start from '../base44/functions/oauthStart/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
let rows;
function setup(user={id:'MEMBER',account_status:'active'}){
 rows=[];globalThis.__testClient={auth:{me:async()=>user},asServiceRole:{entities:{OAuthConnectionState:{create:async row=>{rows.push(row);return {id:'state',...row};}}}}};
 globalThis.__testSecrets=Object.fromEntries(['GOOGLE','YOUTUBE','X'].flatMap(name=>[[name+'_CLIENT_ID','synthetic-client'],[name+'_CLIENT_SECRET','synthetic-secret'],[name+'_REDIRECT_URI','https://perksphere.org/callback?provider='+name.toLowerCase()]]));
}
function privacy(response){assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');}
test('OAuth start requires authenticated POST and blocks unavailable account states',async()=>{
 setup(null);let response=await start(post({provider:'x'}));assert.equal(response.status,401);privacy(response);
 response=await start(new Request('https://test.invalid'));assert.equal(response.status,405);privacy(response);
 for(const account_status of ['disabled','suspended','banned']){setup({id:'MEMBER',account_status});response=await start(post({provider:'x'}));assert.equal(response.status,403);privacy(response);assert.equal(rows.length,0);}
});
test('browser identity fields and malformed bodies cannot create OAuth state',async()=>{
 setup();
 for(const body of [null,[],{provider:'x',user_id:'OTHER'},{provider:'x',actor:{role:'admin'}},{provider:'unknown'}]){
  const response=await start(post(body));assert.equal(response.status,400);privacy(response);
 }assert.equal(rows.length,0);
});
test('provider authorization binds hashed state and PKCE to the authenticated member',async()=>{
 for(const provider of ['google','youtube','x']){
  setup();const response=await start(post({provider}));assert.equal(response.status,200);privacy(response);
  const {authorization_url}=await response.json();const url=new URL(authorization_url),row=rows[0];
  assert.equal(row.user_id,'MEMBER');assert.equal(row.provider,provider);assert.equal(row.state_hash,createHash('sha256').update(url.searchParams.get('state')).digest('hex'));
  assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(row.code_verifier).digest('base64url'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.ok(Date.parse(row.expires_at)>Date.parse(row.created_at));assert.doesNotMatch(authorization_url,/synthetic-secret|code_verifier/);
 }
});
test('state storage failures are redacted and incomplete configuration creates no state',async()=>{
 setup();globalThis.__testClient.asServiceRole.entities.OAuthConnectionState.create=async()=>{throw Error('private-diagnostic-fixture');};
 let response=await start(post({provider:'x'}));assert.equal(response.status,503);privacy(response);assert.doesNotMatch(await response.text(),/private-diagnostic-fixture/);
 setup();delete globalThis.__testSecrets.X_CLIENT_ID;response=await start(post({provider:'x'}));assert.equal(response.status,503);assert.equal(rows.length,0);
});
test.after(()=>{delete globalThis.__testClient;delete globalThis.__testSecrets;});
