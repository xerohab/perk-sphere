import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import config from '../base44/functions/trustedBrowserConfig/entry.ts';
import {ensureLinuxWallet} from '../base44/shared/memberWalletEnrollment.ts';
const secret='test-only-wallet-key';
function signed(body){const raw=JSON.stringify(body),time=String(Math.floor(Date.now()/1000)),nonce=randomUUID(),signature=createHmac('sha256',secret).update(['POST','/functions/trustedBrowserConfig',time,nonce,createHash('sha256').update(raw).digest('hex')].join('\n')).digest('hex');return new Request('https://test.invalid',{method:'POST',body:raw,headers:{'X-PS-Key-ID':'test','X-PS-Timestamp':time,'X-PS-Nonce':nonce,'X-PS-Signature':signature}});}
test('enrollment source binds stored registration date, eligibility and zero balances',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_INBOUND_KEY_ID:'test',PERKSPHERE_LINUX_INBOUND_HMAC_SECRET:secret,PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED:'true'};
 let user={id:'new-member',created_date:'2026-10-11T17:00:00Z',points_balance:0,loyalty_xp:0};let restrictions=[];
 globalThis.__testClient={asServiceRole:{entities:{User:{get:async()=>user},Restriction:{filter:async()=>restrictions},TrustedApiNonce:{filter:async()=>[],create:async()=>({id:'nonce'})}}}};
 let data=(await (await config(signed({action:'wallet_enrollment',user_reference:'new-member'}))).json()).data;
 assert.deepEqual(data,{user_reference:'new-member',eligible:true,registered_at:user.created_date,zero_balances:true});
 user.loyalty_xp=1;data=(await (await config(signed({action:'wallet_enrollment',user_reference:'new-member'}))).json()).data;assert.equal(data.zero_balances,false);
 restrictions=[{type:'points_earning_paused',active:true}];data=(await (await config(signed({action:'wallet_enrollment',user_reference:'new-member'}))).json()).data;assert.equal(data.eligible,false);
 assert.equal((await config(signed({action:'wallet_enrollment',user_reference:'new-member',registered_at:'2099-01-01'}))).status,400);
});
test('wallet enrollment bridge is gated and cannot pass browser balances or timestamps',async()=>{
 const original=globalThis.fetch;
 try{
 globalThis.__testSecrets={};globalThis.fetch=()=>{throw Error('must not call');};await ensureLinuxWallet('member');
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/v1/perk-sphere/ledger/enroll'));assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'member'}});return Response.json({ok:true,data:{enrolled:true}});};
 await ensureLinuxWallet('member');
 globalThis.fetch=async()=>Response.json({ok:true,data:{enrolled:false}});await assert.rejects(ensureLinuxWallet('member'),/unavailable/);
 }finally{globalThis.fetch=original;}
});
