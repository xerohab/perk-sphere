import test from 'node:test';
import assert from 'node:assert/strict';
import callback from '../base44/functions/oauthCallback/entry.ts';
import {validateOAuthTokens,validateProviderIdentity,encryptToken,decryptToken} from '../base44/shared/oauth.ts';

test('provider evidence rejects empty tokens, malformed identities and encryption keys',async()=>{
 for(const body of [{},{access_token:'token',token_type:'basic'},{access_token:'token',token_type:'Bearer',expires_in:-1},{access_token:'token',token_type:'Bearer',expires_in:'3600'}]) assert.throws(()=>validateOAuthTokens(body),/invalid_oauth_token_response/);
 assert.equal(validateOAuthTokens({access_token:'test-token',token_type:'Bearer',expires_in:3600}).access_token,'test-token');
 for(const [provider,id] of [['x',undefined],['x','profile-name'],['youtube','channel-name'],['google','']]) assert.throws(()=>validateProviderIdentity(provider,{provider_user_id:id}),/invalid_provider_identity/);
 assert.equal(validateProviderIdentity('x',{provider_user_id:'12345'}).provider_user_id,'12345');
 await assert.rejects(encryptToken('test-token','z'.repeat(64)),/invalid_token_encryption_key/);
 await assert.rejects(decryptToken('00','00','a'.repeat(64)),/invalid_encrypted_token/);
 const encrypted=await encryptToken('test-token','a'.repeat(64));
 assert.equal(await decryptToken(encrypted.ciphertext,encrypted.iv,'a'.repeat(64)),'test-token');
});

function fixture({expires=new Date(Date.now()+60000).toISOString(),credentialFailure=false,identity='12345',duplicateState=false,invalidToken=false,accountStatus='active',disableDuringLookup=false,missingMember=false}={}){
 const calls=[];const states=[{id:'state-record',user_id:'member-1',code_verifier:'a'.repeat(43),expires_at:expires}];
 const connection={id:'connection-1'};
 globalThis.__testSecrets={X_CLIENT_ID:'test-id',X_CLIENT_SECRET:'test-secret',X_REDIRECT_URI:'https://example.com/callback?provider=x',OAUTH_TOKEN_ENCRYPTION_KEY:'a'.repeat(64)};
 globalThis.__testClient={asServiceRole:{entities:{
  User:{get:async()=>missingMember?null:({id:'member-1',account_status:accountStatus})},
  OAuthConnectionState:{filter:async()=>duplicateState?[...states,...states]:states,update:async()=>calls.push('state-used')},
  ConnectedService:{filter:async()=>[],create:async data=>{calls.push('metadata:'+data.status);return connection;},update:async(id,data)=>calls.push('metadata:'+data.status)},
  ConnectedServiceCredential:{filter:async()=>[],create:async()=>{calls.push('credentials');if(credentialFailure)throw Error('private-error-test-token');}}
 }}};
 globalThis.fetch=async url=>{
  calls.push('provider');
  if(String(url).includes('/oauth2/token'))return Response.json(invalidToken?{}:{access_token:'test-token',token_type:'Bearer',expires_in:3600});
  if(disableDuringLookup)accountStatus='disabled';
  return Response.json({data:{id:identity,name:'Fixture',username:'fixture'}});
 };
 return {calls,request:()=>new Request('https://example.com/callback?provider=x&code=test-code&state='+'a'.repeat(64))};
}
async function scoped(options,run){
 const prior={fetch:globalThis.fetch,client:globalThis.__testClient,secrets:globalThis.__testSecrets,error:console.error};const logs=[];
 try{console.error=(...args)=>logs.push(args.join(' '));const f=fixture(options);await run({...f,logs});}
 finally{globalThis.fetch=prior.fetch;globalThis.__testClient=prior.client;globalThis.__testSecrets=prior.secrets;console.error=prior.error;}
}
test('callback refuses malformed, expired or duplicate state before provider calls',async()=>{
 for(const options of [{expires:'not-a-date'},{expires:new Date(0).toISOString()},{duplicateState:true}]){
  await scoped(options,async({calls,request})=>{const r=await callback(request());assert.match(r.headers.get('location'),/state_(expired|invalid)/);assert.deepEqual(calls,[]);});
 }
});
test('callback cannot label a connection verified when token or identity evidence is invalid',async()=>{
 for(const options of [{identity:null},{invalidToken:true}])await scoped(options,async({calls,request})=>{
  const r=await callback(request());assert.match(r.headers.get('location'),/status=error/);assert.equal(calls.some(x=>x.startsWith('metadata:')),false);
 });
});
test('credential write failure leaves connection pending and redacts provider error text',async()=>{
 await scoped({credentialFailure:true},async({calls,request,logs})=>{
  const r=await callback(request());assert.match(r.headers.get('location'),/credential_storage_failed/);
  assert.ok(calls.includes('metadata:pending'));assert.equal(calls.includes('metadata:connected'),false);
  assert.equal(logs.join(' ').includes('private-error-test-token'),false);
 });
});
test('successful callback publishes connected only after encrypted credential storage',async()=>{
 await scoped({},async({calls,request})=>{
  const r=await callback(request());assert.match(r.headers.get('location'),/status=connected/);
  assert.ok(calls.indexOf('credentials')>calls.indexOf('metadata:pending'));
  assert.ok(calls.indexOf('metadata:connected')>calls.indexOf('credentials'));
 });
});

test('callback rejects disabled or missing members before exchanging provider tokens',async()=>{
 for(const options of [{accountStatus:'disabled'},{accountStatus:'banned'},{accountStatus:'suspended'},{missingMember:true}])await scoped(options,async({calls,request})=>{
  const r=await callback(request());assert.match(r.headers.get('location'),/account_unavailable/);assert.deepEqual(calls,[]);
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 });
});
test('account disabled during provider lookup cannot store credentials or publish connected',async()=>{
 await scoped({disableDuringLookup:true},async({calls,request})=>{
  const r=await callback(request());assert.match(r.headers.get('location'),/account_unavailable/);assert.equal(calls.some(x=>x.startsWith('metadata:')||x==='credentials'),false);
 });
});
test('successful callback redirects have privacy headers and no provider code or token',async()=>{
 await scoped({},async({request})=>{const r=await callback(request());assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.doesNotMatch(r.headers.get('location'),/test-code|test-token|state=/);});
});
