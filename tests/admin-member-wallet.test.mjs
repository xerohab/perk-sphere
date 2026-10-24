import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/getAdminMemberWallet/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
function fixture({role='analyst',userRole='admin',status='active',target=true}={}){
 const calls={users:0,legacy:0};
 const member={id:'member-target',points_balance:7,loyalty_xp:-3,email:'private-not-returned'};
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'test-key',PERKSPHERE_LINUX_HMAC_SECRET:'test-only'};
 globalThis.__testClient={auth:{me:async()=>({id:'staff-current',role:userRole,account_status:status})},asServiceRole:{entities:{
  StaffMember:{filter:async()=>role?[{active:true,staff_role:role}]:[]},
  User:{get:async id=>{calls.users++;assert.equal(id,member.id);return target?member:null;}},
  PointsTransaction:{filter:async(query,sort,limit)=>{calls.legacy++;assert.deepEqual(query,{user_id:member.id});assert.equal(limit,100);return [{amount:7}];}},
  XpTransaction:{filter:async(query)=>{calls.legacy++;assert.deepEqual(query,{user_id:member.id});return [{xp_amount:-3}];}}
 }}};
 return {calls};
}
test('staff wallet rejects members, inactive callers and absent staff grants before reading target data',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=()=>{throw Error('must not call');};
  for(const options of [{userRole:'user'},{role:null},{status:'suspended'},{status:'banned'}]){
   const f=fixture(options);assert.equal((await handler(post({userId:'member-target'}))).status,403);assert.equal(f.calls.users,0);assert.equal(f.calls.legacy,0);
  }
  globalThis.__testClient={auth:{me:async()=>null}};
  assert.equal((await handler(post({userId:'member-target'}))).status,401);
 }finally{globalThis.fetch=original;}
});
test('legacy staff wallet is member-scoped and read-only without leaking the member profile',async()=>{
 const original=globalThis.fetch,f=fixture();
 try{
  globalThis.fetch=()=>{throw Error('must not call');};
  const r=await handler(post({userId:'member-target'})),body=await r.json();
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(body.data.source,'legacy');assert.equal(body.data.points_balance,'7');assert.equal(body.data.loyalty_xp,'-3');assert.equal(f.calls.legacy,2);
  assert.equal(JSON.stringify(body).includes('private-not-returned'),false);
 }finally{globalThis.fetch=original;}
});
test('authoritative staff wallet binds the stored target and preserves exact integers and opening XP',async()=>{
 const original=globalThis.fetch,f=fixture();globalThis.__testSecrets.PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE='true';
 try{
  globalThis.fetch=async(url,init)=>{
   assert.deepEqual(JSON.parse(init.body),{actor:{role:'member',user_reference:'member-target'}});
   if(url.endsWith('/ledger/balance'))return Response.json({ok:true,data:{points_balance:'9007199254740993',xp_balance:'-3',version:'0'}});
   assert.ok(url.endsWith('/ledger/history'));
   return Response.json({ok:true,data:[{operation_uuid:'11111111-1111-4111-8111-111111111111',operation_type:'opening_balance',points_delta:'9007199254740993',xp_delta:'-3',status:'applied',applied_at:'2026-10-24T10:00:00.000Z'}]});
  };
  const r=await handler(post({userId:'member-target'})),body=await r.json();
  assert.equal(r.status,200);assert.equal(body.data.source,'linux');assert.equal(body.data.points_balance,'9007199254740993');assert.equal(body.data.xp[0].xp_amount,'-3');assert.equal(body.data.xp[0].xp_after,null);assert.equal(f.calls.legacy,0);
 }finally{globalThis.fetch=original;}
});
test('staff wallet never falls back to saved balances on failed or corrupt Linux reads',async()=>{
 const original=globalThis.fetch;
 try{
  for(const corrupt of [false,true]){
   const f=fixture();globalThis.__testSecrets.PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE='true';
   globalThis.fetch=async url=>corrupt?Response.json({ok:true,data:url.endsWith('/ledger/history')?[]:{points_balance:9007199254740992,xp_balance:'0',version:'0'}}):Response.json({ok:false},{status:503});
   const r=await handler(post({userId:'member-target'}));assert.equal(r.status,503);assert.equal(f.calls.legacy,0);assert.equal((await r.json()).data,undefined);
  }
 }finally{globalThis.fetch=original;}
});
test('staff wallet rejects identity/amount overrides and unknown members without enrollment',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=()=>{throw Error('must not call');};
  for(const body of [{userId:'member-target',actor:{role:'admin'}},{userId:'member-target',points:99},{userId:'../other'},{}]){
   const f=fixture();assert.equal((await handler(post(body))).status,400);assert.equal(f.calls.users,0);
  }
  fixture({target:false});assert.equal((await handler(post({userId:'member-target'}))).status,404);
  assert.equal((await handler(new Request('https://test.invalid'))).status,405);
 }finally{globalThis.fetch=original;}
});
