import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {isValidLinuxPath} from '../base44/shared/linuxPath.ts';
import createCode from '../base44/functions/createBrowserPairingCode/entry.ts';
import listDevices from '../base44/functions/listBrowserDevices/entry.ts';
import revoke from '../base44/functions/revokeBrowserDevice/entry.ts';
const post=body=>new Request('https://example.test/function',{method:'POST',body:JSON.stringify(body)});
const key='test-key',secret='test-only-device-signing-key';
function setup(fetchImpl){
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:key,PERKSPHERE_LINUX_HMAC_SECRET:secret};
 globalThis.__testClient={auth:{me:async()=>({id:'actual-member'})},asServiceRole:{entities:{AuditLog:{create:async row=>{assert.equal(JSON.stringify(row).includes('TEST-CODE'),false);}}}}};
 globalThis.fetch=async(url,options)=>{
  assert.equal(new URL(url).origin,'https://api.perksphere.org');
  const headers=options.headers;
  const canonical=['POST',new URL(url).pathname,headers['X-PS-Timestamp'],headers['X-PS-Nonce'],createHash('sha256').update(options.body).digest('hex')].join('\n');
  assert.equal(headers['X-PS-Signature'],createHmac('sha256',secret).update(canonical).digest('hex'));
  return fetchImpl(new URL(url).pathname,JSON.parse(options.body));
 };
}
const original={fetch:globalThis.fetch,client:globalThis.__testClient,secrets:globalThis.__testSecrets};
test.after(()=>{globalThis.fetch=original.fetch;globalThis.__testClient=original.client;globalThis.__testSecrets=original.secrets;});
test('only the three existing account-device operations pass the path allowlist',()=>{
 for(const path of ['/v1/account-devices/pairing/create','/v1/account-devices/list','/v1/account-devices/revoke'])assert.equal(isValidLinuxPath(path),true);
 for(const path of ['/v1/account-devices/anything','/v1/account-devices/pairing/consume','/v1/account-devices/list?user=other','/v1/account-devices/../list','/v1/account-devices/%2e%2e/list','//evil.test/v1/account-devices/list'])assert.equal(isValidLinuxPath(path),false);
});
test('pairing code creation reaches Linux with server-derived identity and canonical HMAC',async()=>{
 setup(async(path,body)=>{assert.equal(path,'/v1/account-devices/pairing/create');assert.deepEqual(body,{user_reference:'actual-member',device_name:'Browser extension'});return Response.json({ok:true,data:{pairing_code:'TEST-CODE',expires_in_seconds:600}});});
 const result=await createCode(post({user_reference:'forged-member'}));assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{ok:true,data:{pairing_code:'TEST-CODE',expires_in_seconds:600}});
});
test('device listing uses the restored route and strips private device tokens',async()=>{
 setup(async(path,body)=>{assert.equal(path,'/v1/account-devices/list');assert.deepEqual(body,{user_reference:'actual-member'});return Response.json({ok:true,data:{devices:[{device_uuid:'device',status:'active',device_token:'private-token',token_hash:'private-hash'}]}});});
 const result=await listDevices(post({user_reference:'forged-member'}));assert.equal(result.status,200);assert.deepEqual((await result.json()).data.devices,[{device_uuid:'device',status:'active'}]);
});
test('device revocation binds the authenticated owner and anonymous requests do not reach Linux',async()=>{
 setup(async(path,body)=>{assert.equal(path,'/v1/account-devices/revoke');assert.deepEqual(body,{user_reference:'actual-member',device_uuid:'device'});return Response.json({ok:true});});
 assert.equal((await revoke(post({device_uuid:'device',user_reference:'forged-member'}))).status,200);
 globalThis.fetch=async()=>{throw Error('No anonymous network access');};
 for(const auth of [async()=>null,async()=>{throw Error('SDK unauthorized');}]){
  globalThis.__testClient.auth.me=auth;
  for(const handler of [createCode,listDevices,revoke])assert.equal((await handler(post({device_uuid:'device'}))).status,401);
 }
});
