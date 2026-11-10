import test from 'node:test';import assert from 'node:assert/strict';
import {createGiftCheckoutRecoveryAuthorityHandler as create} from '../base44/shared/giftCheckoutRecoveryAuthorityHandler.ts';
const body={userReference:'operator',permission:'gift_checkout_recovery:read',requestReference:'request1234567890',scope:{userReference:'member',checkoutUuid:'12345678-1234-4234-8234-123456789012'},expiresAt:new Date(2000).toISOString()};
const request=()=>new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('recovery authority evaluates actual staff catalog and echoes exact scope',async()=>{
 for(const role of ['super_admin','admin']){
  const handler=create({getSecret:()=> 'true',clock:()=>1000,getClient:()=>({asServiceRole:{entities:{User:{get:async()=>({id:'operator',role:'admin'})},StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}}),verify:async req=>({ok:true,rawBody:await req.text()})});
  const r=await handler(request());assert.equal(r.status,200);const b=await r.json();assert.equal(b.data.authorized,role==='super_admin');assert.deepEqual(b.data.scope,body.scope);
 }
});
test('recovery authority rejects unverified transport and expired requests',async()=>{
 const handler=create({getSecret:()=> 'true',getClient:()=>({asServiceRole:{}}),verify:async()=>({ok:false,status:401})});assert.equal((await handler(request())).status,401);
});
