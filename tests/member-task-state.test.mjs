import test from 'node:test';
import assert from 'node:assert/strict';
import {memberTaskState} from '../src/lib/member-task-state.js';
const task={id:'task',active:true,completion_limit_type:'once_daily'};
const done=at=>({task_id:'task',status:'completed',completed_at:at});
test('daily task returns to available at midnight UTC regardless of local offset',()=>{
 const rows=[done('2026-10-30T23:59:59Z')];
 assert.equal(memberTaskState(task,rows,new Date('2026-10-31T00:00:00Z')).status,'available');
 assert.equal(memberTaskState(task,rows,new Date('2026-10-30T23:59:59Z')).status,'completed');
 assert.equal(memberTaskState(task,rows,new Date('2026-10-31T01:00:00+01:00')).progress,null);
});
test('weekly tasks reset on Monday UTC; one-off and campaign tasks do not reset',()=>{
 const rows=[done('2026-11-01T12:00:00Z')],now=new Date('2026-11-02T00:00:00Z');
 assert.equal(memberTaskState({...task,completion_limit_type:'once_weekly'},rows,now).status,'available');
 for(const type of ['once_ever','once_campaign'])assert.equal(memberTaskState({...task,completion_limit_type:type},rows,now).status,'completed');
});
test('cooldowns and completion limits remain visible until they expire',()=>{
 const rows=[done('2026-10-30T12:00:00Z')];
 assert.equal(memberTaskState({...task,completion_limit_type:'unlimited',cooldown_seconds:60},rows,new Date('2026-10-30T12:00:59Z')).status,'completed');
 assert.equal(memberTaskState({...task,completion_limit_type:'unlimited',cooldown_seconds:60},rows,new Date('2026-10-30T12:01:00Z')).status,'available');
 assert.equal(memberTaskState({...task,completion_limit_type:'custom_max',max_completions:1},rows).status,'completed');
});
test('current progress wins over past completions in an eligible new period',()=>{
 const active={task_id:'task',status:'in_progress',last_activity:'2026-10-31T12:00:00Z'};
 const rows=[done('2026-10-30T12:00:00Z'),active,{task_id:'other',status:'completed'}];
 const state=memberTaskState(task,rows,new Date('2026-10-31T12:00:00Z'));assert.equal(state.status,'in_progress');assert.equal(state.progress,active);
});
test('upcoming, expired and hidden tasks cannot appear available',()=>{
 const now=new Date('2026-10-30T12:00:00Z');
 assert.equal(memberTaskState({...task,available_from:'2026-11-01T00:00:00Z'},[],now).status,'upcoming');
 assert.equal(memberTaskState({...task,available_until:'2026-10-29T00:00:00Z'},[],now).status,'expired');
 assert.equal(memberTaskState({...task,publicly_visible:false},[],now).status,'hidden');
});
