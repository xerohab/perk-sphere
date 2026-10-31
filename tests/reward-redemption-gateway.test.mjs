import test from 'node:test';
import assert from 'node:assert/strict';
import {createRewardRedemptionHandler} from '../base44/shared/rewardRedemptionGateway.ts';
const now=Date.parse('2026-10-31T12:00:00Z');
const request=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
function fixture(){
 let user={id:'MEMBER',account_status:'active'},authoritative=false,reads=0,writes=0;
 const restrictions=[];
 const admin={entities:{Restriction:{filter:async q=>{reads++;assert.deepEqual(q,{user_id:'MEMBER'});return restrictions;}}}};
 const result={redemption:{id:'RECEIPT',user_id:'MEMBER',reward_id:'REWARD',points_spent:20,status:'pending',admin_note:'PRIVATE INTERNAL',reward_name:'An item'},balance_after:0};
 const args={getClient:()=>({auth:{me:async()=>user},get asServiceRole(){return admin;}}),isAuthoritative:()=>authoritative,clock:()=>now,redeem:async(ctx,input)=>{writes++;assert.equal(ctx,admin);assert.deepEqual(input,{userId:'MEMBER',rewardId:'REWARD'});return result;}};
 return {args,handler:createRewardRedemptionHandler(args),restrictions,result,setUser:value=>{user=value;},setAuthoritative:value=>{authoritative=value;},counts:()=>({reads,writes})};
}
test('method and authentication boundaries are private and touch no reward state',async()=>{
 const f=fixture();let response=await f.handler(new Request('https://test.invalid'));assert.equal(response.status,405);assert.equal(response.headers.get('cache-control'),'no-store');
 f.setUser(null);response=await f.handler(request({rewardId:'REWARD'}));assert.equal(response.status,401);assert.deepEqual(f.counts(),{reads:0,writes:0});
});
test('authoritative wallets are paused before restriction reads or legacy redemption',async()=>{
 const f=fixture();f.setAuthoritative(true);const response=await f.handler(request({rewardId:'REWARD'}));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'reward_redemption_paused'});assert.deepEqual(f.counts(),{reads:0,writes:0});
});
test('restricted accounts and active or malformed restrictions cannot redeem',async()=>{
 for(const account_status of ['disabled','suspended','banned']){
  const f=fixture();f.setUser({id:'MEMBER',account_status});assert.equal((await f.handler(request({rewardId:'REWARD'}))).status,403);assert.deepEqual(f.counts(),{reads:0,writes:0});
 }
 for(const restriction of [{type:'account_review',active:true},{type:'redemption_disabled',active:true,start_date:'bad-date'},{type:'temporary_suspension',active:true}]){
  const f=fixture();f.restrictions.push(restriction);assert.equal((await f.handler(request({rewardId:'REWARD'}))).status,403);assert.equal(f.counts().writes,0);
 }
});
test('forged identity, extra keys, invalid IDs and oversized input cannot reach private reads',async()=>{
 for(const body of [null,[],{}, {rewardId:'REWARD',userId:'OTHER'},{rewardId:'../private'},{rewardId:'REWARD',points:0},{rewardId:'x'.repeat(5000)}]){
  const f=fixture();const response=await f.handler(request(body));assert.equal(response.status,400);assert.deepEqual(f.counts(),{reads:0,writes:0});
 }
});
test('legacy response is whitelisted and binds the exact member, reward and receipt',async()=>{
 const f=fixture(),response=await f.handler(request({rewardId:'REWARD'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.ok,true);assert.equal(data.balance_after,0);assert.equal(data.redemption.status,'pending');assert.equal(data.redemption.admin_note,undefined);assert.equal(response.headers.get('cache-control'),'no-store');
 for(const patch of [{user_id:'OTHER'},{reward_id:'OTHER'},{status:'fulfilled'},{points_spent:-1}]){
  const g=fixture();Object.assign(g.result.redemption,patch);assert.equal((await g.handler(request({rewardId:'REWARD'}))).status,503);
 }
});
test('unexpected private failures and excessive restriction sets return generic unavailable responses',async()=>{
 const f=fixture();f.args.redeem=async()=>{throw Error('PRIVATE PROVIDER PASSWORD');};
 const handler=createRewardRedemptionHandler(f.args),response=await handler(request({rewardId:'REWARD'}));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE|PASSWORD/);
 const g=fixture();g.restrictions.push(...Array(101).fill({type:'other'}));assert.equal((await g.handler(request({rewardId:'REWARD'}))).status,503);assert.equal(g.counts().writes,0);
});
