import test from 'node:test';
import assert from 'node:assert/strict';
import status from '../base44/functions/getPartnerLinuxStatus/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const record={linux_api_partner_id:'0d5996bf-471c-49c0-a4df-39af4cfeddb7',partner_key_id:'psp_ujlMGJtS1IV4U2llbKgWtaR-'};
test('member cannot inspect privileged Linux partner status',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'member',role:'user'})}};
 assert.equal((await status(post({partnerId:'partner'}))).status,403);
});
test('staff status uses stored identifiers and returns no secrets or writes',async()=>{
 let writes=0;const original=globalThis.fetch;
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'service-test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only-verbatim'};
 globalThis.__testClient={auth:{me:async()=>({id:'staff',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'admin',active:true}]},PartnerIntegration:{get:async()=>record,update:async()=>writes++}}}};
 try {
  globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/partners/status'));assert.deepEqual(JSON.parse(init.body),{partner_uuid:record.linux_api_partner_id,partner_key_id:record.partner_key_id});return Response.json({ok:true,partner:{...record,partner_uuid:record.linux_api_partner_id,status:'active',enabled:true,verification_enabled:true,credential_status:'active',possession_verified:true,verified_link_count:'1',encrypted_secret:'DO NOT RETURN'}});};
  const response=await status(post({partnerId:'partner'}));assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes('DO NOT RETURN'),false);assert.equal(writes,0);
  assert.equal((await status(post({partnerId:'partner',partner_uuid:'override'}))).status,400);
  globalThis.fetch=async()=>Response.json({ok:true,partner:{partner_uuid:'wrong'}});assert.equal((await status(post({partnerId:'partner'}))).status,502);
 } finally {globalThis.fetch=original;}
});
