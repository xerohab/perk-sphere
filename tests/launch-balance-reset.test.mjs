import test from 'node:test';
import assert from 'node:assert/strict';
import {resetMember, assertLegacyWritesAllowed} from '../base44/shared/launchBalanceReset.ts';
import {adjustPoints} from '../base44/shared/rewards.ts';
function fixture({failBackup=false,failUpdate=false,duplicates=false}={}) {
  const user={id:'member',points_balance:100,loyalty_xp:60,loyalty_rank:'Gold',account_status:'restricted'};
  const snapshots=[]; const writes=[];
  const admin={entities:{
    Setting:{filter:async()=>[]},
    User:{get:async()=>({...user}),update:async(id,patch)=>{if(failUpdate)throw Error('interrupted');writes.push('user');Object.assign(user,patch);}},
    LaunchBalanceSnapshot:{
      filter:async()=>duplicates?[{},{}]:snapshots,
      create:async row=>{if(failBackup)throw Error('backup failed');writes.push('backup');const result={id:'snapshot',...row};snapshots.push(result);return result;},
      update:async(id,patch)=>{writes.push('verified');Object.assign(snapshots[0],patch);}
    }
  }};
  return {admin,user,snapshots,writes};
}
test('reset backs up before updating and preserves account status',async()=>{
  const f=fixture();await resetMember(f.admin,f.user,'staff','Bronze');
  assert.deepEqual(f.writes,['backup','user','verified']);
  assert.equal(f.snapshots[0].previous_points,100);assert.equal(f.snapshots[0].previous_xp,60);
  assert.equal(f.user.points_balance,0);assert.equal(f.user.loyalty_xp,0);assert.equal(f.user.account_status,'restricted');
});
test('backup failure cannot clear a balance',async()=>{
  const f=fixture({failBackup:true});await assert.rejects(resetMember(f.admin,f.user,'staff','Bronze'));
  assert.equal(f.user.points_balance,100);assert.deepEqual(f.writes,[]);
});
test('retry retains the original snapshot and completed retries do not rewrite',async()=>{
  const f=fixture(); const update=f.admin.entities.User.update;
  f.admin.entities.User.update=async()=>{throw Error('interrupted');};
  await assert.rejects(resetMember(f.admin,f.user,'staff','Bronze'));
  f.admin.entities.User.update=update;
  await resetMember(f.admin,f.user,'staff','Bronze');const count=f.writes.length;
  await resetMember(f.admin,f.user,'staff','Bronze');
  assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0].previous_points,100);assert.equal(f.writes.length,count);
});
test('changed balances and duplicate snapshots require review',async()=>{
  const f=fixture();await resetMember(f.admin,f.user,'staff','Bronze');f.user.points_balance=1;
  await assert.rejects(resetMember(f.admin,f.user,'staff','Bronze'),/balance_changed/);
  const d=fixture({duplicates:true});await assert.rejects(resetMember(d.admin,d.user,'staff','Bronze'),/duplicate/);assert.deepEqual(d.writes,[]);
});
test('freeze blocks legacy awards before any transaction or balance write',async()=>{
  const f=fixture();f.admin.entities.Setting.filter=async()=>[{value:'true'}];
  await assert.rejects(assertLegacyWritesAllowed(f.admin),/frozen/);
  await assert.rejects(adjustPoints(f.admin,{userId:'member',amount:10}),/frozen/);assert.deepEqual(f.writes,[]);
});
test('freeze lookup failure fails closed',async()=>{
  const f=fixture();f.admin.entities.Setting.filter=async()=>{throw Error('offline');};
  await assert.rejects(adjustPoints(f.admin,{userId:'member',amount:10}),/offline/);assert.deepEqual(f.writes,[]);
});
