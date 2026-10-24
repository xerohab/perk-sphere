import test from 'node:test';
import assert from 'node:assert/strict';
import prepare from '../base44/functions/prepareWalletOpening/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
function fixture({role='admin',frozen=false,users=[{id:'one',points_balance:42,loyalty_xp:9},{id:'two',points_balance:0,loyalty_xp:-3}],duplicates=false,auditFailure=false}={}){
 const settings=[{id:'control',key:'perk_sphere_balance_reset_freeze',value:frozen?'true':'false'}];if(duplicates)settings.push({...settings[0],id:'duplicate'});
 const writes=[];globalThis.__testSecrets={};
 globalThis.__testClient={auth:{me:async()=>({id:'staff',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{staff_role:role,active:true}]},Setting:{filter:async()=>settings,update:async(_id,data)=>{writes.push(['Setting',data]);Object.assign(settings[0],data);},create:async data=>{writes.push(['Setting',data]);settings.push(data);}},AuditLog:{create:async data=>{if(auditFailure)throw Error('offline');writes.push(['AuditLog',data]);}},User:{list:async(sort,limit,offset)=>{assert.equal(sort,'id');assert.equal(limit,25);assert.equal(offset,0);return users;},update:()=>{throw Error('balances must never be changed');}}}}};
 return {settings,writes,users};
}
test('preserved opening export freezes earning and retains every existing balance',async()=>{
 const f=fixture(),before=structuredClone(f.users);assert.equal((await prepare(post({action:'freeze'}))).status,200);assert.equal(f.settings[0].value,'true');
 const response=await prepare(post({action:'export',offset:0}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.legacy_writers_frozen,true);assert.deepEqual(data.members.map(row=>[row.points,row.xp]),[['42','9'],['0','-3']]);assert.deepEqual(f.users,before);assert.ok(data.verified_at.endsWith('Z'));
});
test('unfrozen and duplicate earning controls cannot produce an opening snapshot',async()=>{
 for(const config of [{frozen:false},{frozen:true,duplicates:true}]){const f=fixture(config);assert.equal((await prepare(post({action:'export'}))).status,409);assert.equal(f.writes.length,0);}
});
test('unsupported balances stop export without resetting any member',async()=>{
 for(const change of [{points_balance:-1},{points_balance:0.5},{loyalty_xp:9007199254740992}]){const f=fixture({frozen:true,users:[{id:'one',points_balance:0,loyalty_xp:0,...change}]});assert.equal((await prepare(post({action:'export'}))).status,409);assert.equal(f.writes.length,0);}
});
test('earning may be resumed before authority cutover without changing balances',async()=>{
 const f=fixture({frozen:true});const response=await prepare(post({action:'resume'}));assert.equal(response.status,200);assert.equal(f.settings[0].value,'false');assert.deepEqual(await response.json(),{frozen:false,balances_changed:false});
});
test('cutover authority and insufficient staff permissions block opening controls',async()=>{
 const f=fixture();globalThis.__testSecrets={PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE:'true'};assert.equal((await prepare(post({action:'resume'}))).status,409);assert.equal(f.writes.length,0);
 for(const role of ['support','analyst','rewards_manager']){const denied=fixture({role});assert.equal((await prepare(post({action:'freeze'}))).status,403);assert.equal(denied.writes.length,0);}
});
test('audit failure and browser balance overrides cannot mutate earning controls',async()=>{
 const failed=fixture({auditFailure:true});assert.equal((await prepare(post({action:'freeze'}))).status,409);assert.equal(failed.settings[0].value,'false');
 const f=fixture();assert.equal((await prepare(post({action:'freeze',points:0}))).status,400);assert.equal((await prepare(new Request('https://test.invalid'))).status,405);assert.equal(f.writes.length,0);
});
