import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {receiveLedgerDelivery} from '../base44/shared/ledgerDelivery.ts';
const payload=()=>({event_type:'LEDGER_APPLIED',delivery_uuid:randomUUID(),operation_uuid:randomUUID(),user_reference:'member:1',operation_type:'task_reward',points_delta:'9007199254740993',xp_delta:'5'});
test('ledger receipt retries do not mutate balances or create sequential duplicates',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};let rows=[],writes=0;
 const admin={entities:{User:{get:async id=>({id}),update:async()=>{throw Error('no balance write');}},LedgerDeliveryReceipt:{filter:async()=>rows,create:async row=>{rows.push(row);writes++;}}}};
 const p=payload();assert.equal((await receiveLedgerDelivery(admin,p)).status,200);assert.equal((await receiveLedgerDelivery(admin,p)).status,200);assert.equal(writes,1);assert.equal(rows[0].points_delta,'9007199254740993');
 assert.equal((await receiveLedgerDelivery(admin,{...p,xp_delta:'9'})).status,409);assert.equal(writes,1);
});
test('receipt rejects overrides and stays unavailable before ledger cutover',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};const admin={entities:{}};
 for(const extra of [{points_delta:10},{points_delta:'9223372036854775808'},{reward_points:100},{user_reference:'bad/user'}])assert.equal((await receiveLedgerDelivery(admin,{...payload(),...extra})).status,400);
 globalThis.__testSecrets={};assert.equal((await receiveLedgerDelivery(admin,payload())).status,503);
});
