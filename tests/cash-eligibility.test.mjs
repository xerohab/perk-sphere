import test from 'node:test';
import assert from 'node:assert/strict';
import {readCashEligibility as read} from '../base44/shared/cashEligibility.ts';
const flags={PERKSPHERE_CASH_SOURCE_ENABLED:'true',PERKSPHERE_CASH_MEMBER_ENABLED:'true',PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};
function fixture(restrictions=[]){return {entities:{User:{get:async()=>({id:'MEMBER',account_status:'active'})},Restriction:{filter:async()=>restrictions}}};}
const options={getSecret:key=>flags[key],clock:()=>Date.parse('2026-10-31T12:00:00Z')};
test('cash source stays off without all financial gates before private member reads',async()=>{
 for(const key of Object.keys(flags)){const result=await read({entities:{User:{get:()=>{throw Error('MUST_NOT_READ');}}}},{userReference:'MEMBER',operation:'convert'},{...options,getSecret:name=>name===key?'false':flags[name]});assert.equal(result.eligible,false);}
});
test('cash restriction policy separates conversion, withdrawal, read and release actions',async()=>{
 const restriction=type=>({user_id:'MEMBER',type,active:true});
 for(const type of ['account_review','temporary_suspension','redemption_disabled','cash_operations_paused']){
  for(const operation of ['convert','reserve'])assert.equal((await read(fixture([restriction(type)]),{userReference:'MEMBER',operation},options)).eligible,false);
 }
 assert.equal((await read(fixture([restriction('withdrawal_disabled')]),{userReference:'MEMBER',operation:'reserve'},options)).eligible,false);
 assert.equal((await read(fixture([restriction('cash_conversion_disabled')]),{userReference:'MEMBER',operation:'convert'},options)).eligible,false);
 for(const operation of ['wallet','policy','release'])assert.equal((await read(fixture([restriction('withdrawal_disabled')]),{userReference:'MEMBER',operation},options)).eligible,true);
});
test('disabled or mismatched members and uncertain restriction pages cannot authorize cash',async()=>{
 for(const member of [null,{id:'OTHER'},{id:'MEMBER',account_status:'suspended'}]){const admin=fixture();admin.entities.User.get=async()=>member;assert.equal((await read(admin,{userReference:'MEMBER',operation:'convert'},options)).eligible,false);}
 for(const restrictions of [null,Array.from({length:201},()=>({user_id:'MEMBER',type:'withdrawal_disabled'})),[{user_id:'OTHER',type:'account_review'}]])await assert.rejects(read(fixture(restrictions),{userReference:'MEMBER',operation:'reserve'},options),/CASH_RESTRICTIONS_UNAVAILABLE/);
});
test('expired restrictions no longer block cash; malformed dates remain blocked',async()=>{
 const r={user_id:'MEMBER',type:'account_review',active:true,end_date:'2026-10-30T00:00:00Z'};
 assert.equal((await read(fixture([r]),{userReference:'MEMBER',operation:'convert'},options)).eligible,true);
 assert.equal((await read(fixture([{...r,end_date:'invalid'}]),{userReference:'MEMBER',operation:'convert'},options)).eligible,false);
 await assert.rejects(read(fixture(),{userReference:'MEMBER',operation:'payout'},options),/INVALID_CASH_ELIGIBILITY/);
});
