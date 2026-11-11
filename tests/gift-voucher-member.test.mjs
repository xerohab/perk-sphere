import test from 'node:test';
import assert from 'node:assert/strict';
import {giftVoucherRequest,projectGiftVoucherResult} from '../base44/shared/giftVoucherContract.ts';
import {createGiftVoucherMemberHandler as create} from '../base44/shared/giftVoucherMemberHandler.ts';
import entry from '../base44/functions/revealGiftVoucher/entry.ts';
const command={intentUuid:'12345678-1234-4234-8234-123456789012',requestReference:'22345678-1234-4234-8234-123456789012'};
const voucher={voucherId:'synthetic',code:'SYNTHETIC-CODE',currency:'GBP',faceValueMinor:'1000',redemptionUrl:'https://example.invalid/redeem',expiresAt:null,instructions:'Use the original voucher.'};
const report=()=>({intent_uuid:command.intentUuid,voucher,duplicate:false,provider_delivery_verified:false});
const request=(body=command,headers={})=>new Request('https://test.invalid/reveal',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer synthetic',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
function fixture(patch={}){
 let calls=0;const env={PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED:'true'};
 return {env,calls:()=>calls,handler:create({getClient:()=>({auth:{me:async()=>({id:'owner',role:'user'})}}),getSecret:k=>env[k],post:async(path,b)=>{calls++;assert.equal(path,'/v1/perk-sphere/gift-vouchers/reveal');assert.deepEqual(b,{...command,actor:{role:'member',user_reference:'owner'}});return {ok:true,data:{data:report()}};},...patch})};
}
test('voucher member contract rejects identity injection and unsafe/private receipt fields',()=>{
 assert.throws(()=>giftVoucherRequest({...command,userReference:'other'}));
 for(const patch of [{privateKey:'private'},{code:''},{redemptionUrl:'javascript:alert(1)'},{redemptionUrl:'https://user:pass@example.invalid/redeem'},{faceValueMinor:'01'}])assert.throws(()=>projectGiftVoucherResult({...report(),voucher:{...voucher,...patch}},command));
 assert.throws(()=>projectGiftVoucherResult({...report(),intent_uuid:'other'},command));
});
test('member gateway derives owner from actual SDK identity and emits an uncacheable validated receipt',async()=>{
 const f=fixture(),r=await f.handler(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).data,report());assert.equal(f.calls(),1);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');
});
test('paused, unauthenticated, blocked and cookie-only requests do not reach Linux',async()=>{
 const f=fixture();f.env.PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED='false';assert.equal((await f.handler(request())).status,503);assert.equal(f.calls(),0);
 for(const user of [null,{id:'owner',account_status:'banned'}]){const g=fixture({getClient:()=>({auth:{me:async()=>user}})});assert.equal((await g.handler(request())).status,401);assert.equal(g.calls(),0);}
 const g=fixture();assert.equal((await g.handler(request(command,{Authorization:''}))).status,403);assert.equal(g.calls(),0);
});
test('oversized and malformed member requests fail before storage and never echo content',async()=>{
 for(const [body,status] of [['x'.repeat(4097),413],['{"PRIVATE":',400],[{...command,actor:{user_reference:'other'}},400]]){
  const f=fixture(),r=await f.handler(request(body));assert.equal(r.status,status);assert.equal(f.calls(),0);assert.doesNotMatch(await r.text(),/PRIVATE/);
 }
});
test('session replacement after Linux read suppresses voucher plaintext',async()=>{
 let n=0;const f=fixture({getClient:()=>({auth:{me:async()=>({id:++n<3?'owner':'other',role:'user'})}})}),r=await f.handler(request());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/SYNTHETIC-CODE/);
});
test('actual member function signs SDK owner without requiring an admin role',async()=>{
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic'};globalThis.__testClient={auth:{me:async()=>({id:'owner',role:'user'})}};
 globalThis.fetch=async()=>Response.json({ok:true,data:report()});
 try{assert.equal((await entry(request())).status,200);}finally{globalThis.fetch=original;delete globalThis.__testSecrets;delete globalThis.__testClient;}
});
