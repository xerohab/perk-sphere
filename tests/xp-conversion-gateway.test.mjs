import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let code=await readFile(new URL('../base44/functions/convertXp/entry.ts',import.meta.url),'utf8');
for(const [line,replacement] of [
 ["import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';","const createClientFromRequest=globalThis.__xp.client;"],
 ["import {linuxTrustedPost} from '../../shared/linuxClient.ts';","const linuxTrustedPost=globalThis.__xp.post;"],
 ["import {assertAccountEligible} from '../../shared/rewardPolicy.ts';","const assertAccountEligible=globalThis.__xp.eligible;"],
 ["import {secrets} from 'base44:runtime';","const secrets=globalThis.__xp.secrets;"]
]){if(!code.includes(line))throw Error('fixture mismatch');code=code.replace(line,replacement);}
let user=null,enabled=false,calls=[],failure=null;const id='00000000-0000-4000-8000-000000000001';
globalThis.__xp={client:()=>({auth:{me:async()=>user},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}}),eligible:()=>{},secrets:{get:()=>enabled?'true':'false'},post:async(path,body)=>{calls.push({path,body});if(failure)return failure;return {ok:true,data:path.endsWith('/policy')?{version:1,input_xp:100,output_points:10}:{duplicate:false,operationUuid:id,xpSpent:'100',pointsCredited:'10'}};}};
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const req=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('conversion gate and member authentication fail closed',async()=>{calls=[];enabled=false;assert.equal((await handler(req({action:'policy'}))).status,503);enabled=true;user=null;assert.equal((await handler(req({action:'policy'}))).status,401);assert.equal(calls.length,0);});
test('request cannot choose another member or payout and correct member reaches API',async()=>{user={id:'MEMBER'};calls=[];assert.equal((await handler(req({action:'convert',xp:100,policy_version:1,request_reference:id,points:999}))).status,400);let r=await handler(req({action:'policy'}));assert.equal(r.status,200);r=await handler(req({action:'convert',xp:100,policy_version:1,request_reference:id}));assert.equal(r.status,200);assert.equal((await r.json()).data.points_credited,'10');assert.deepEqual(calls[1].body,{actor:{role:'member',user_reference:'MEMBER'},request_reference:id,xp:100,policy_version:1});});
test('only a definitive policy-change rejection permits a new conversion identity',async()=>{
 enabled=true;user={id:'MEMBER'};
 try{
  failure={ok:false,status:409,code:'CONVERSION_POLICY_CHANGED'};
  let r=await handler(req({action:'convert',xp:100,policy_version:1,request_reference:id}));assert.equal(r.status,409);assert.equal((await r.json()).retry_with_new_policy,true);
  for(const error of [{status:503,code:'linux_unreachable'},{status:409,code:'INSUFFICIENT_BALANCE'},{status:409,code:'CONVERSION_REQUEST_CONFLICT'},{status:503,code:'CONVERSION_POLICY_CHANGED'}]){
   failure={ok:false,...error};r=await handler(req({action:'convert',xp:100,policy_version:1,request_reference:id}));assert.equal(r.status,503);assert.equal((await r.json()).retry_with_new_policy,undefined);
  }
 }finally{failure=null;}
});
test.after(()=>delete globalThis.__xp);
