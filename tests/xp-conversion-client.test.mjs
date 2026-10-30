import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingConversion,conversionInput,confirmedConversion,definitivePolicyChange} from '../src/lib/xp-conversion-client.js';
const request={action:'convert',request_reference:'00000000-0000-4000-8000-000000000001',xp:100,policy_version:1};
test('recovery requests retain their exact identity and reject corrupt or augmented records',()=>{
 assert.equal(pendingConversion(null),null);assert.deepEqual(pendingConversion(JSON.stringify(request)),request);
 for(const raw of ['bad','null','{}',JSON.stringify({...request,xp:0}),JSON.stringify({...request,xp:100.5}),JSON.stringify({...request,request_reference:'bad'}),JSON.stringify({...request,user_id:'OTHER'})])assert.throws(()=>pendingConversion(raw),/recovery_record_invalid/);
});
test('XP input requires exact whole increments and safe integers',()=>{
 assert.equal(conversionInput('200',{input_xp:100}),200);
 for(const raw of ['1e2','-100','0','100.5','9007199254740992','250',''])assert.throws(()=>conversionInput(raw,{input_xp:100}),/invalid_amount/);
});
test('only a matching confirmed receipt permits clearing a pending conversion',()=>{
 const receipt={duplicate:false,xp_spent:'100',points_credited:'10'};assert.equal(confirmedConversion(receipt,request),true);assert.equal(confirmedConversion({...receipt,duplicate:true},request),true);
 for(const change of [{xp_spent:'200'},{points_credited:'0'},{points_credited:10},{duplicate:null}])assert.equal(confirmedConversion({...receipt,...change},request),false);
});
test('network uncertainty and insufficient balances never authorize a replacement request',()=>{
 assert.equal(definitivePolicyChange({response:{status:409,data:{error:'conversion_policy_changed',retry_with_new_policy:true}}}),true);
 for(const error of [Error('timeout'),{response:{status:503,data:{error:'conversion_policy_changed',retry_with_new_policy:true}}},{response:{status:409,data:{error:'INSUFFICIENT_BALANCE'}}},{response:{status:409,data:{error:'conversion_policy_changed'}}}])assert.equal(definitivePolicyChange(error),false);
});
