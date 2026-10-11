import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import config from '../base44/functions/trustedBrowserConfig/entry.ts';
const secret='test-only-eligibility-key';
function signed(body){const raw=JSON.stringify(body),time=String(Math.floor(Date.now()/1000)),nonce=randomUUID();const signature=createHmac('sha256',secret).update(['POST','/functions/trustedBrowserConfig',time,nonce,createHash('sha256').update(raw).digest('hex')].join('\n')).digest('hex');return new Request('https://test.invalid',{method:'POST',body:raw,headers:{'X-PS-Key-ID':'test','X-PS-Timestamp':time,'X-PS-Nonce':nonce,'X-PS-Signature':signature}});}
test('trusted game eligibility reads account restrictions and exposes no balances',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_INBOUND_KEY_ID:'test',PERKSPHERE_LINUX_INBOUND_HMAC_SECRET:secret,PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};
 let restrictions=[];let user={id:'member-1',points_balance:500};
 globalThis.__testClient={asServiceRole:{entities:{User:{get:async()=>user},Restriction:{filter:async()=>restrictions},TrustedApiNonce:{filter:async()=>[],create:async()=>({id:'nonce'})}}}};
 const response=await config(signed({action:'game_eligibility',user_reference:'member-1'}));assert.equal(response.status,200);assert.deepEqual((await response.json()).data,{user_reference:'member-1',eligible:true});
 restrictions=[{type:'points_earning_paused',active:true}];assert.equal((await (await config(signed({action:'game_eligibility',user_reference:'member-1'}))).json()).data.eligible,false);
 restrictions=[];user={id:'member-1',account_status:'banned'};assert.equal((await (await config(signed({action:'game_eligibility',user_reference:'member-1'}))).json()).data.eligible,false);
 user={id:'member-1'};globalThis.__testSecrets.PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE='false';assert.equal((await (await config(signed({action:'game_eligibility',user_reference:'member-1'}))).json()).data.eligible,false);
});
