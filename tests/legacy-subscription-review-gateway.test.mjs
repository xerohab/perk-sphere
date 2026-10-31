import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../prepared/getLegacySubscriptionReview/entry.ts';
const originalFetch=globalThis.fetch;
const body={environment:'sandbox',limit:25,offset:0};
const post=b=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)});
function fixture(role='analyst'){
 globalThis.__testClient={auth:{me:async()=>({id:'STAFF',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}};
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic'};
 const data={read_only:true,environment:'sandbox',limit:25,offset:0,counts:{processing:'1',review:'0'},items:[{event_reference:'EVENT-1',event_type:'BILLING.SUBSCRIPTION.CANCELLED',status:'processing',age_seconds:'20',scope_hash:'a'.repeat(64),guard_status:'processing',scope_consistent:true,claim_uuid:'PRIVATE_TOKEN'}],has_more:false,recovery_enabled:false,acceptance_verified:false,private_detail:'PRIVATE'};
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://api.perksphere.org/v1/perk-sphere/legacy-subscription-review/queue');assert.deepEqual(JSON.parse(options.body),{actor:{user_reference:'STAFF',role:'admin'},...body});return Response.json({ok:true,data});};
 return data;
}
test('staged subscription queue authenticates staff and derives actor server-side',async()=>{
 fixture();globalThis.__testClient.auth.me=async()=>null;assert.equal((await handler(post(body))).status,401);
 fixture();globalThis.__testClient.auth.me=async()=>({id:'MEMBER',role:'user'});assert.equal((await handler(post(body))).status,403);
 fixture();assert.equal((await handler(post({...body,actor:{role:'admin'}}))).status,400);
});
test('read-only review projects only allowed metadata with no credentials',async()=>{
 fixture();const r=await handler(post(body));assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const text=await r.text();assert.doesNotMatch(text,/PRIVATE|claim_uuid|private_detail/);assert.equal(JSON.parse(text).data.recovery_enabled,false);
});
test('cross-environment, malformed and unsafe recovery responses fail closed',async()=>{
 for(const change of [d=>d.environment='live',d=>d.recovery_enabled=true,d=>d.acceptance_verified=true,d=>d.counts.processing=-1,d=>d.items[0].scope_hash='private',d=>d.items.push(d.items[0])]){
  const d=fixture();change(d);assert.equal((await handler(post(body))).status,503);
 }
 fixture();globalThis.fetch=async()=>{throw Error('PRIVATE');};const r=await handler(post(body));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE/);
});
test('invalid queue pagination and methods cannot call Linux',async()=>{
 fixture();globalThis.fetch=()=>{throw Error('MUST_NOT_CALL');};
 for(const b of [{...body,offset:10001},{...body,limit:101},{...body,environment:'other'}])assert.equal((await handler(post(b))).status,400);
 assert.equal((await handler(new Request('https://test.invalid'))).status,405);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
