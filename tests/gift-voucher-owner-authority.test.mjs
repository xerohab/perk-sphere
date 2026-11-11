import test from 'node:test';import assert from 'node:assert/strict';
import {createGiftVoucherOwnerAuthorityHandler as create} from '../base44/shared/giftVoucherOwnerAuthorityHandler.ts';
const body={userReference:'owner',permission:'gift_voucher:read',scope:{intentUuid:'12345678-1234-4234-8234-123456789012',requestReference:'22345678-1234-4234-8234-123456789012'},requestNonce:'requestnonce123456',expiresAt:new Date(2000).toISOString()};
const request=(b=body)=>new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
function handler(user,patch={}){
 return create({getSecret:()=> 'true',getClient:()=>({asServiceRole:{entities:{User:{get:async id=>{assert.equal(id,'owner');return user;}}}}}),clock:()=>1000,verify:async(req,admin,path)=>{assert.equal(path,'/functions/trustedGiftVoucherOwnerAuthority');return {ok:true,rawBody:await req.text()};},...patch});
}
test('voucher authority permits only the exact currently active member and echoes original reveal scope',async()=>{
 for(const [u,allowed] of [[{id:'owner',role:'user'},true],[{id:'owner',role:'admin'},true],[{id:'other',role:'user'},false],[{id:'owner',role:'user',account_status:'disabled'},false],[null,false]]){
  const r=await handler(u)(request());assert.equal(r.status,200);const d=(await r.json()).data;assert.equal(d.authorized,allowed);assert.deepEqual(d.scope,body.scope);assert.equal(d.requestNonce,body.requestNonce);
 }
});
test('voucher authority rejects unverified, expired, oversized and injected requests before member disclosure',async()=>{
 assert.equal((await handler(null,{verify:async()=>({ok:false,status:401})})(request())).status,401);
 assert.equal((await handler(null)(request({...body,expiresAt:new Date(1000).toISOString()}))).status,403);
 assert.equal((await handler(null)(request({...body,scope:{...body.scope,userReference:'other'}}))).status,503);
 const paused=handler(null,{getSecret:()=> 'false'});assert.equal((await paused(request())).status,503);
});
