function unwrap(value){
 for(let i=0;i<4;i++){
  if(value?.ok===false)throw Error('Report service unavailable');
  if(value?.ok===true&&value.data!==undefined){value=value.data;continue;}
  return value;
 }
 throw Error('Invalid report response');
}
function count(value){
 if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))throw Error('Invalid report count');
 if(!/^(0|[1-9][0-9]*)$/.test(String(value)))throw Error('Invalid report count');
 return BigInt(value);
}
export function readWeeklyReport(value){
 const body=unwrap(value),report=body?.report||body?.preview||body;
 if(!report||!Array.isArray(report.activity)||!Array.isArray(report.reward_requests))throw Error('Invalid weekly report');
 return report;
}
export function readReportArchives(value){
 const body=unwrap(value),rows=Array.isArray(body)?body:body?.archives;
 if(!Array.isArray(rows))throw Error('Invalid report archives');
 return rows;
}
export function readReportArchive(value){
 const body=unwrap(value),archive=body?.archive||body;
 if(!archive||typeof archive!=='object'||Array.isArray(archive))throw Error('Invalid archive');
 return archive;
}
export function summarizeWeeklyReport(report){
 if(!Array.isArray(report?.activity)||!Array.isArray(report?.reward_requests))throw Error('Invalid weekly report');
 let total=0n,verified=0n,pending=0n,rejected=0n,rewardPending=0n,rewardApproved=0n;
 const types=new Map(),classes=new Map();
 for(const row of report.activity){
  const n=count(row.count??1),state=row.verification_state||row.verification_status;
  total+=n;
  if(['verified','api_verified'].includes(state))verified+=n;
  if(['received','pending','pending_verification','unverified','extension_detected'].includes(state))pending+=n;
  if(['rejected','invalidated'].includes(state))rejected+=n;
  const type=row.activity_type||'unknown',classification=row.classification||'neutral';
  types.set(type,(types.get(type)||0n)+n);classes.set(classification,(classes.get(classification)||0n)+n);
 }
 for(const row of report.reward_requests){
  const n=count(row.count??1);
  if(['pending','pending_review'].includes(row.status))rewardPending+=n;
  if(['approved','acknowledged'].includes(row.status))rewardApproved+=n;
 }
 return {
  totalActivities:String(total),verified:String(verified),pending:String(pending),rejected:String(rejected),
  rewardPending:String(rewardPending),rewardApproved:String(rewardApproved),
  activitiesByType:[...types].map(([type,n])=>({type,count:String(n)})),
  activitiesByClass:[...classes].map(([classification,n])=>({classification,count:String(n)})),
  isEmptyWeek:total===0n&&report.reward_requests.every(row=>count(row.count??1)===0n)
 };
}
