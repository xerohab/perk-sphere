import test from 'node:test';
import assert from 'node:assert/strict';
import {readWeeklyReport,readReportArchives,readReportArchive,summarizeWeeklyReport} from '../src/lib/report-presentation.js';
test('weekly report counts activities within groups rather than group rows',()=>{
 const report={activity:[{activity_type:'quiz_attempt',classification:'neutral',verification_state:'verified',count:8},{activity_type:'quiz_attempt',classification:'neutral',verification_state:'pending_verification',count:2}],reward_requests:[{status:'pending_review',count:7},{status:'acknowledged',count:3}]};
 const s=summarizeWeeklyReport(report);assert.equal(s.totalActivities,'10');assert.equal(s.verified,'8');assert.equal(s.pending,'2');assert.equal(s.rewardPending,'7');assert.equal(s.rewardApproved,'3');assert.deepEqual(s.activitiesByType,[{type:'quiz_attempt',count:'10'}]);assert.deepEqual(s.activitiesByClass,[{classification:'neutral',count:'10'}]);assert.equal(s.isEmptyWeek,false);
});
test('extension detection or processing state alone does not establish verified activity',()=>{
 const s=summarizeWeeklyReport({activity:[{verification_status:'extension_detected',processing_state:'processed',count:3},{verification_state:'rejected',count:4}],reward_requests:[]});assert.equal(s.verified,'0');assert.equal(s.pending,'3');assert.equal(s.rejected,'4');
});
test('large string counts preserve integer precision and malformed counts fail closed',()=>{
 const s=summarizeWeeklyReport({activity:[{count:'9007199254740993'}],reward_requests:[]});assert.equal(s.totalActivities,'9007199254740993');
 for(const count of [-1,1.5,'NaN',9007199254740992])assert.throws(()=>summarizeWeeklyReport({activity:[{count}],reward_requests:[]}));
});
test('success envelopes retain preview, archive lists and stored archive content',()=>{
 const report={activity:[],reward_requests:[]};assert.equal(readWeeklyReport({ok:true,data:{report}}),report);assert.equal(summarizeWeeklyReport(report).isEmptyWeek,true);
 const archives=[{id:'one'}];assert.deepEqual(readReportArchives({ok:true,data:{archives}}),archives);
 const archive={id:'one',totals:{a:1}};assert.equal(readReportArchive({ok:true,data:{archive}}),archive);
 assert.throws(()=>readReportArchives({ok:false}));assert.throws(()=>readWeeklyReport({ok:true,data:{}}));
});
