import test from 'node:test';
import assert from 'node:assert/strict';
import {xpPolicyUpdate} from '../src/lib/xp-policy-form.js';
test('first conversion policy is always a disabled draft and has no invented default rate',()=>{
 assert.deepEqual(xpPolicyUpdate({policy:{configured:false},inputXp:'100',outputPoints:'10',enabled:true}),{action:'update',expected_version:0,input_xp:100,output_points:10,enabled:false});
 assert.throws(()=>xpPolicyUpdate({policy:{configured:false},inputXp:'',outputPoints:'',enabled:false}));
});
test('existing policy saves retain the observed version and only allowed request fields',()=>{
 const result=xpPolicyUpdate({policy:{configured:true,version:4},inputXp:'200',outputPoints:'12',enabled:true});
 assert.deepEqual(result,{action:'update',expected_version:4,input_xp:200,output_points:12,enabled:true});assert.equal(result.actor,undefined);
});
test('fractional, scientific, negative and excessive rates cannot reach the policy gateway',()=>{
 for(const inputXp of ['0','-1','1.5','1e2','1000000001','9007199254740992'])assert.throws(()=>xpPolicyUpdate({policy:{configured:false},inputXp,outputPoints:'10',enabled:false}));
});
