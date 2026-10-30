import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPublicHomeData} from '../src/lib/public-home-data.js';
const now=new Date('2026-10-30T12:00:00Z');
const reward={id:'reward',active:true,stock_available:1};
const task={id:'task',active:true,publicly_visible:true,featured:true};
function client(rewards=[reward],tasks=[task]){
 return {entities:{Reward:{filter:async query=>{assert.deepEqual(query,{active:true});return rewards;}},Task:{filter:async query=>{assert.deepEqual(query,{active:true,publicly_visible:true,featured:true});return tasks;}},LoyaltyLevel:{list:async()=>[{name:'Gold',minimum_xp:10},{name:'Bronze',minimum_xp:0}]}}};
}
test('public homepage sections survive an independent catalogue failure',async()=>{
 const c=client();c.entities.Reward.filter=async()=>{throw Error('unavailable');};
 const {data,failed}=await loadPublicHomeData(c,now);assert.deepEqual(failed,['rewards']);assert.deepEqual(data.rewards,[]);assert.equal(data.tasks[0].id,'task');assert.equal(data.levels[0].name,'Bronze');
});
test('public previews exclude unavailable, expired and malformed entries',async()=>{
 const rewards=[reward,{...reward,id:'future',start_date:'2027-01-01'},{...reward,id:'expired',end_date:now.toISOString()},{...reward,id:'invalid',end_date:'bad'},{...reward,id:'empty',stock_available:0},{...reward,id:'unlimited',unlimited_stock:true,stock_available:0}];
 const tasks=[task,{...task,id:'expired',available_until:now.toISOString()},{...task,id:'hidden',publicly_visible:false},{...task,id:'future',available_from:'2027-01-01'},{...task,id:'invalid',available_from:'bad'},{...task,id:'ended',task_type:'live_stream',event_end:'2020-01-01'}];
 const {data,failed}=await loadPublicHomeData(client(rewards,tasks),now);assert.deepEqual(failed,[]);assert.deepEqual(data.rewards.map(row=>row.id),['reward','unlimited']);assert.deepEqual(data.tasks.map(row=>row.id),['task']);
});
test('invalid section response is reported rather than mistaken for a genuine empty catalogue',async()=>{
 const c=client();c.entities.Task.filter=async()=>({data:[]});const result=await loadPublicHomeData(c,now);assert.deepEqual(result.failed,['tasks']);assert.equal(result.data.rewards.length,1);
});
