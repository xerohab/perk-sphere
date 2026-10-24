import test from 'node:test';
import assert from 'node:assert/strict';
import {fullWatchRewards,fullWatchError,taskActivationError} from '../base44/shared/fullWatch.ts';
import {finalizeCompletion} from '../base44/shared/taskCompletion.ts';
import manage from '../base44/functions/manageTask/entry.ts';
const full={id:'full-task',name:'Full episode',task_type:'watch_video',required_percentage:100,required_seconds:3219,content_duration_seconds:3219,content_duration_source:'operator_media_probe',content_duration_verified_at:'2026-10-24T20:50:08.288Z',content_media_url_sha256:'a'.repeat(64),active:false};
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
test('full-content rewards scale by independently verified runtime',()=>{
 assert.deepEqual(fullWatchRewards(3219),{points:108,xp:216});
 assert.deepEqual(fullWatchRewards(4839),{points:162,xp:324});
 assert.ok(fullWatchRewards(4839).points>fullWatchRewards(3219).points);
 for(const duration of [0,-1,NaN,Infinity,3219.1,'3219',86401])assert.throws(()=>fullWatchRewards(duration));
});
test('full-content completion needs duration provenance and an exact duration requirement',()=>{
 assert.equal(fullWatchError(full),null);
 for(const change of [{content_duration_seconds:0},{required_seconds:5},{content_duration_source:'browser'},{content_duration_verified_at:null},{content_media_url_sha256:'unknown'}])assert.ok(fullWatchError({...full,...change}));
 assert.equal(fullWatchError({task_type:'watch_video',required_percentage:0,required_seconds:300}),null);
 assert.ok(taskActivationError({...full,reward_processing:'linux_partner'}));
});
test('partner task drafts and invalid full-video definitions cannot enter legacy reward writes',async()=>{
 const admin=new Proxy({},{get:()=>{throw Error('unexpected entity access');}});
 await assert.rejects(finalizeCompletion(admin,{task:{...full,reward_processing:'linux_partner'}}),/independent transactional/);
 await assert.rejects(finalizeCompletion(admin,{task:{...full,required_seconds:0}}),/verified duration/);
});
function fixture(before){
 let writes=0;
 globalThis.__testClient={auth:{me:async()=>({id:'staff',role:'admin'})},asServiceRole:{entities:{
  StaffMember:{filter:async()=>[{active:true,staff_role:'admin'}]},
  Task:{get:async()=>before,update:async()=>{writes++;},create:async()=>{writes++;}}
 }}};
 return ()=>writes;
}
test('publish and partial updates cannot bypass pending partner-task verification',async()=>{
 let writes=fixture({...full,reward_processing:'linux_partner'});
 assert.equal((await manage(post({action:'publish',taskId:full.id}))).status,409);assert.equal(writes(),0);
 writes=fixture({...full,reward_processing:'linux_partner'});
 assert.equal((await manage(post({action:'update',taskId:full.id,data:{active:true}}))).status,409);assert.equal(writes(),0);
 writes=fixture({...full,active:true});
 assert.equal((await manage(post({action:'update',taskId:full.id,data:{content_duration_seconds:0}}))).status,409);assert.equal(writes(),0);
 writes=fixture(full);
 assert.equal((await manage(post({action:'create',data:{...full,content_duration_seconds:0,active:true}}))).status,409);assert.equal(writes(),0);
});
