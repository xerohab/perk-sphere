import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPartnerLinkReward} from '../base44/shared/partnerLinkReward.ts';
test('link payouts stay off before both explicit activation and authoritative wallet cutover',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not call');};
 try {for(const flags of [{},{PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'},{PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED:'true'}]){
 globalThis.__testSecrets=flags;assert.equal((await requestPartnerLinkReward('partner','member')).issued,false);
 }}finally{globalThis.fetch=original;}
});
test('trusted bridge forwards fixed member identity without reward amounts',async()=>{
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 try {globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/v1/perk-sphere/partner-rewards/claim-link'));assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'member'},partner_uuid:'partner'});return Response.json({ok:true,data:{issued:true}});};
 assert.equal((await requestPartnerLinkReward('partner','member')).issued,true);
 }finally{globalThis.fetch=original;}
});
test('an unavailable payout bridge leaves the verified connection usable',async()=>{
 const original=globalThis.fetch;globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 try {globalThis.fetch=async()=>Response.json({ok:false,error:{code:'unavailable'}},{status:503});assert.equal((await requestPartnerLinkReward('partner','member')).reason,'link_reward_pending');}finally{globalThis.fetch=original;}
});
