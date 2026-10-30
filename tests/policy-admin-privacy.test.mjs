import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import xp from '../base44/functions/manageXpConversion/entry.ts';
import streak from '../base44/functions/manageVerifiedStreak/entry.ts';
const post=()=>new Request('https://test.invalid',{method:'POST',body:'{}'});
for(const [name,handler] of [['XP policy',xp],['streak policy',streak]])test(name+' authentication and permission failures cannot be cached',async()=>{
 globalThis.__testSecrets={PERKSPHERE_XP_CONVERSION_ADMIN_ENABLED:'true',PERKSPHERE_VERIFIED_STREAK_ADMIN_ENABLED:'true'};
 globalThis.__testClient={auth:{me:async()=>null}};let response=await handler(post());assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');
 globalThis.__testClient.auth.me=async()=>({id:'MEMBER',role:'user'});response=await handler(post());assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test.after(()=>{delete globalThis.__testClient;delete globalThis.__testSecrets;});
