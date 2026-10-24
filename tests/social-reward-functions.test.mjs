import test from 'node:test';
import assert from 'node:assert/strict';
import claim from '../base44/functions/claimSocialLinkReward/entry.ts';
import policies from '../base44/functions/manageSocialRewardPolicies/entry.ts';
const request=body=>new Request('https://example.com/function',{method:'POST',body:JSON.stringify(body)});
const original={fetch:globalThis.fetch,client:globalThis.__testClient,secrets:globalThis.__testSecrets};
test.after(()=>{globalThis.fetch=original.fetch;globalThis.__testClient=original.client;globalThis.__testSecrets=original.secrets;});
test('social claim derives member from authentication and rejects browser ownership and reward fields',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'actual-member'})}};
 globalThis.__testSecrets={PERKSPHERE_SOCIAL_LINK_REWARDS_ENABLED:'true',PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only-service-key'};
 globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).pathname,'/v1/perk-sphere/social-rewards/claim-link');assert.deepEqual(JSON.parse(options.body),{provider:'x',actor:{role:'member',user_reference:'actual-member'}});return Response.json({ok:true,data:{issued:false,duplicate:true}});};
 const result=await claim(request({provider:'x'}));assert.equal(result.status,200);assert.equal((await result.json()).data.duplicate,true);
 for(const fields of [{user_id:'other'},{points:1000},{account_reference:'123'}])assert.equal((await claim(request({provider:'x',...fields}))).status,400);
});
test('disabled social claim never calls Linux and anonymous callers cannot claim',async()=>{
 globalThis.__testSecrets={};
 globalThis.__testClient={auth:{me:async()=>({id:'actual-member'})}};
 globalThis.fetch=async()=>{throw Error('No network allowed');};
 assert.equal((await (await claim(request({provider:'youtube'}))).json()).data.reason,'social_rewards_disabled');
 globalThis.__testClient={auth:{me:async()=>null}};assert.equal((await claim(request({provider:'x'}))).status,401);
});
test('social policy changes require rules.manage and never accept a browser actor',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'analyst',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'analyst',active:true}]}}}};
 assert.equal((await policies(request({action:'update',policy:{},reason:'test'}))).status,403);
 assert.equal((await policies(request({action:'list',actor:{role:'admin',user_reference:'forged'}}))).status,400);
});
test('authorized policy save binds audit actor to authenticated staff identity',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only-service-key'};
 globalThis.__testClient={auth:{me:async()=>({id:'actual-admin',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:'admin',active:true}]}}}};
 const policy={provider:'x',enabled:false,points:0,xp:0,version:1};
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(new URL(url).pathname,'/v1/perk-sphere/social-rewards/policy');assert.deepEqual(body.actor,{role:'admin',user_reference:'actual-admin'});assert.deepEqual(body.policy,policy);return Response.json({ok:true,data:{...policy,version:2}});};
 const result=await policies(request({action:'update',policy,reason:'Launch review'}));assert.equal(result.status,200);assert.equal((await result.json()).data.version,2);
});
