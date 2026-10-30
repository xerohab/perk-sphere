import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDashboardData} from '../src/lib/dashboard-data.js';
function client(fail){
 const calls=[],entities={};
 for(const name of ['LoyaltyLevel','Activity','Reward','UserAchievement','Task','TaskProgress'])entities[name]={list:async(...args)=>{calls.push({name,args});if(fail===name)throw Error('private failure');return [{id:name}];},filter:async(...args)=>{calls.push({name,args});if(fail===name)throw Error('private failure');return [{id:name}];}};
 return {entities,calls};
}
test('one unavailable section does not block other dashboard sections',async()=>{
 const c=client('Activity'),r=await loadDashboardData(c,'MEMBER');assert.deepEqual(r.failed,['activities']);assert.deepEqual(r.data.activities,[]);assert.equal(r.data.tasks[0].id,'Task');assert.equal(r.data.rewards[0].id,'Reward');assert.ok(!JSON.stringify(r).includes('private failure'));
});
test('member-specific activity, achievements and task progress use authenticated member filter',async()=>{
 const c=client();await loadDashboardData(c,'MEMBER');
 for(const name of ['Activity','UserAchievement','TaskProgress'])assert.deepEqual(c.calls.find(x=>x.name===name).args[0],{user_id:'MEMBER'});
});
test('missing identity prevents all requests; malformed sections fail safely',async()=>{
 const c=client();await assert.rejects(loadDashboardData(c,null));assert.equal(c.calls.length,0);
 c.entities.Reward.list=async()=>({bad:true});const r=await loadDashboardData(c,'MEMBER');assert.deepEqual(r.data.rewards,[]);assert.deepEqual(r.failed,['rewards']);
});
