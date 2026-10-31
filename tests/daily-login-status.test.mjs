import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/dailyLoginStatus/entry.ts';
const req=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body??{})});
function fixture(user={id:'MEMBER'}){
 globalThis.__testClient={auth:{me:async()=>user}};
 globalThis.__testSecrets={PERKSPHERE_DAILY_LOGIN_ENABLED:'true',PERKSPHERE_LINUX_KEY_ID:'test',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
}
test('status requires authentication and paused settings do not call Linux',async()=>{
 fixture(null);assert.equal((await handler(req())).status,401);
 fixture();globalThis.__testSecrets.PERKSPHERE_DAILY_LOGIN_ENABLED='false';assert.deepEqual(await(await handler(req())).json(),{enabled:false});
});
test('status reads the server member claim and penalty policy without invoking the award route',async()=>{
 fixture();const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,init)=>{
   assert.ok(url.endsWith('/v1/perk-sphere/daily-login/status'));
   assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'MEMBER'}});
   return Response.json({ok:true,data:{enabled:true,day:'2026-10-31',claimed:true,penalty_enabled:true,penalty_points_per_day:1,points_deducted:2}});
  };
  const r=await handler(req());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await r.json(),{enabled:true,user_reference:'MEMBER',day:'2026-10-31',claimed:true,penalty_enabled:true,penalty_points_per_day:1,points_deducted:2});
 }finally{globalThis.fetch=original;}
});
test('forged identity, disabled accounts and malformed status fail closed',async()=>{
 fixture();assert.equal((await handler(req({user_reference:'OTHER'}))).status,400);
 fixture({id:'MEMBER',account_status:'disabled'});assert.equal((await handler(req())).status,403);
 fixture();const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({ok:true,data:{enabled:true,day:'2026-10-31'}});assert.equal((await handler(req())).status,503);}finally{globalThis.fetch=original;}
});
