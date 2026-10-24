import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveLedgerDelivery} from '../base44/shared/ledgerDelivery.ts';
const task='6add18607277b6ca86efab43';
const body={event_type:'LEDGER_APPLIED',delivery_uuid:'11111111-1111-4111-8111-111111111111',operation_uuid:'22222222-2222-4222-8222-222222222222',user_reference:'member',operation_type:'partner_reward',points_delta:'10',xp_delta:'20',task_reference:task};
function fixture(){
 const receipts=[],progress=[],writes=[];let failProjection=false,failTaskRead=false;
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};
 const admin={entities:{
  User:{get:async id=>({id}),update:()=>{throw Error('must never write balances');}},
  LedgerDeliveryReceipt:{filter:async query=>receipts.filter(r=>r.delivery_uuid===query.delivery_uuid),create:async data=>{receipts.push({...data,id:'receipt'});}},
  Task:{get:async id=>{if(failTaskRead)throw Error('temporary source error');return {id,name:'Test video',task_type:'watch_video',reward_processing:'linux_partner'};}},
  TaskProgress:{filter:async query=>progress.filter(r=>r.user_id===query.user_id&&r.task_id===query.task_id),
   create:async data=>{if(failProjection)throw Error('injected projection failure');writes.push(data);progress.push({...data,id:'progress'});},
   update:async(id,data)=>{writes.push(data);Object.assign(progress.find(r=>r.id===id),data);}}
 }};
 return {admin,receipts,progress,writes,setFail:value=>failProjection=value,setReadFail:value=>failTaskRead=value};
}
test('trusted applied task delivery projects completion once without another balance adjustment',async()=>{
 const f=fixture();assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);assert.equal(f.progress.length,1);assert.equal(f.progress[0].points_issued,10);assert.equal(f.progress[0].xp_issued,20);assert.equal(f.progress[0].ledger_operation_uuid,body.operation_uuid);
 assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);assert.equal(f.receipts.length,1);assert.equal(f.writes.length,1);
});
test('projection failure retries an existing immutable receipt without minting another reward',async()=>{
 const f=fixture();f.setFail(true);
 assert.equal((await receiveLedgerDelivery(f.admin,body)).status,503);assert.equal(f.receipts.length,1);assert.equal(f.progress.length,0);
 f.setFail(false);assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);assert.equal(f.receipts.length,1);assert.equal(f.progress.length,1);
});
test('temporary task-read failure cannot acknowledge away the completion projection',async()=>{
 const f=fixture();f.setReadFail(true);assert.equal((await receiveLedgerDelivery(f.admin,body)).status,503);f.setReadFail(false);assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);assert.equal(f.progress.length,1);
});
test('task identity is bound into receipt hash and malformed or negative task deliveries fail closed',async()=>{
 const f=fixture();assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);
 assert.equal((await receiveLedgerDelivery(f.admin,{...body,task_reference:'6add18607277b6ca86efab44'})).status,409);
 for(const change of [{task_reference:'../other'},{operation_type:'reversal'},{points_delta:'-1'},{xp_delta:'1000001'}])assert.equal((await receiveLedgerDelivery(f.admin,{...body,...change})).status,400);
 assert.equal(f.progress.length,1);
});
test('an existing in-progress task is completed from the ledger operation, not duplicated',async()=>{
 const f=fixture();f.progress.push({id:'pending',user_id:'member',task_id:task,status:'in_progress',reward_issued:false});
 assert.equal((await receiveLedgerDelivery(f.admin,body)).status,200);assert.equal(f.progress.length,1);assert.equal(f.progress[0].id,'pending');assert.equal(f.progress[0].status,'completed');
});
