import test from 'node:test';
import assert from 'node:assert/strict';
import play from '../base44/functions/playGame/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('games require authentication and reject browser identity and reward overrides',async()=>{
 globalThis.__testClient={auth:{me:async()=>null}};
 assert.equal((await play(post({action:'start',game_reference:'number-memory'}))).status,401);
 globalThis.__testClient={auth:{me:async()=>({id:'member-1'})},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}};
 for(const field of ['actor','points','elapsed_seconds'])assert.equal((await play(post({action:'start',game_reference:'number-memory',[field]:100}))).status,400);
});
test('game bridge derives member and forwards only the game command',async()=>{
 const original=globalThis.fetch;
 globalThis.__testClient={auth:{me:async()=>({id:'member-1'})},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}};
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 try {
  globalThis.fetch=async(url,init)=>{
   assert.ok(url.endsWith('/v1/perk-sphere/games/play'));
   assert.deepEqual(JSON.parse(init.body),{action:'start',game_reference:'number-memory',actor:{role:'member',user_reference:'member-1'}});
   return Response.json({ok:true,data:{status:'active',game_reference:'number-memory',challenge:'123456',eligible_seconds:0,required_seconds:300}});
  };
  assert.equal((await play(post({action:'start',game_reference:'number-memory'}))).status,200);
 }finally{globalThis.fetch=original;}
});
test('restricted accounts cannot earn game rewards',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'member-1'})},asServiceRole:{entities:{Restriction:{filter:async()=>[{type:'points_earning_paused',active:true}]}}}};
 assert.equal((await play(post({action:'start',game_reference:'number-memory'}))).status,403);
});
test('failed game authentication is reported as sign-in required without outbound calls',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not call Linux');};
 globalThis.__testClient={auth:{me:async()=>{throw Error('no session');}}};
 try{assert.equal((await play(post({action:'start',game_reference:'number-memory'}))).status,401);}finally{globalThis.fetch=previous;}
});
test('malformed game JSON is rejected before wallet enrollment or gameplay',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not call Linux');};
 globalThis.__testClient={auth:{me:async()=>({id:'member-1'})},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}};
 try{assert.equal((await play(new Request('https://test.invalid',{method:'POST',body:'{'}))).status,400);}finally{globalThis.fetch=previous;}
});
