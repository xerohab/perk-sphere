import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/getGameCatalog/entry.ts';
import {NATIVE_GAME_IDS} from '../base44/shared/nativeGames.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;
const row={game_reference:'digit-order',title:'Digit Order',enabled:true,required_seconds:60,points:2,xp:5,version:1};
test('catalog authenticates the member and rejects browser identity or reward fields',async()=>{
 globalThis.__testClient={auth:{me:async()=>null}};assert.equal((await handler(post({}))).status,401);
 globalThis.__testClient={auth:{me:async()=>({id:'MEMBER'})},asServiceRole:{entities:{Restriction:{filter:async()=>[]}}}};
 assert.equal((await handler(post({actor:{role:'admin'}}))).status,400);
 assert.equal((await handler(post({points:99}))).status,400);
});
test('catalog returns only validated server-owned policies for the authenticated member',async()=>{
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic-key',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic secret not a credential'};
 let called=0;
 globalThis.fetch=async(url,init)=>{called++;assert.ok(String(url).endsWith('/v1/perk-sphere/games/catalog'));assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'MEMBER'}});return Response.json({ok:true,data:[row]});};
 const response=await handler(post({}));assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data[0].game_reference,'digit-order');assert.equal(data[0].version,undefined);assert.equal(called,1);
});
test('unavailable or malformed policies are not advertised as playable',async()=>{
 for(const change of [{enabled:false},{points:-1},{game_reference:'unsupported'}]){globalThis.fetch=async()=>Response.json({ok:true,data:[{...row,...change}]});assert.equal((await handler(post({}))).status,503);}
 assert.ok(NATIVE_GAME_IDS.includes('digit-shift'));
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
