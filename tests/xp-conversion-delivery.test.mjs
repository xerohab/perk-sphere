import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {receiveLedgerDelivery} from '../base44/shared/ledgerDelivery.ts';import {readLinuxWallet} from '../base44/shared/walletRead.ts';
test('XP conversion is accepted as a receipt and appears in both wallet histories',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 const payload={event_type:'LEDGER_APPLIED',delivery_uuid:randomUUID(),operation_uuid:randomUUID(),user_reference:'member:1',operation_type:'xp_conversion',points_delta:'10',xp_delta:'-100'},rows=[];
 const admin={entities:{User:{get:async id=>({id})},LedgerDeliveryReceipt:{filter:async()=>rows,create:async r=>rows.push(r)}}};
 assert.equal((await receiveLedgerDelivery(admin,payload)).status,200);assert.equal(rows.length,1);
 const original=globalThis.fetch;try{globalThis.fetch=async url=>Response.json({ok:true,data:url.endsWith('/balance')?{points_balance:'10',xp_balance:'400',version:'2'}:[{operation_uuid:payload.operation_uuid,operation_type:'xp_conversion',status:'applied',applied_at:'2026-10-27T10:00:00.000Z',points_delta:'10',xp_delta:'-100'}]});const wallet=await readLinuxWallet('member:1');assert.equal(wallet.points[0].amount,'10');assert.equal(wallet.xp[0].xp_amount,'-100');}finally{globalThis.fetch=original;}
});
