const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const amount=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const version=v=>Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const utc=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const cursor=v=>v===null||typeof v==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(v);
export function validRewardedQuizBody(b){
 if(!b||typeof b!=='object'||Array.isArray(b))return false;
 if(b.action==='catalog')return exact(b,['action','after_quiz','limit'])&&(b.after_quiz===null||UUID.test(b.after_quiz||''))&&Number.isSafeInteger(b.limit)&&b.limit>=1&&b.limit<=25;
 if(b.action==='history')return exact(b,['action','before','limit'])&&cursor(b.before)&&Number.isSafeInteger(b.limit)&&b.limit>=1&&b.limit<=25;
 if(b.action==='questions')return exact(b,['action','quiz_uuid'])&&UUID.test(b.quiz_uuid||'');
 if(b.action!=='submit'||!exact(b,['action','quiz_uuid','policy_version','answers'])||!UUID.test(b.quiz_uuid||'')||!version(b.policy_version)||!Array.isArray(b.answers)||b.answers.length<1||b.answers.length>30)return false;
 return b.answers.every(a=>exact(a,['question_uuid','selected_index'])&&UUID.test(a.question_uuid||'')&&Number.isSafeInteger(a.selected_index)&&a.selected_index>=0&&a.selected_index<=5)&&new Set(b.answers.map(a=>a.question_uuid.toLowerCase())).size===b.answers.length;
}
function quiz(q,payouts){
 if(!q||!UUID.test(q.quiz_uuid||'')||typeof q.title!=='string'||!q.title.trim()||q.title.length>255||typeof q.description!=='string'||q.description.length>10000||q.provider!=='partner'||!version(q.policy_version)||!amount(q.points)||!amount(q.xp)||q.points+q.xp===0||!Number.isSafeInteger(q.passing_percent)||q.passing_percent<1||q.passing_percent>100||!Number.isSafeInteger(q.question_count)||q.question_count<1||q.question_count>30||!['available','submitted','previous_attempt','daily_limit','paused','review_required'].includes(q.state))throw Error('INVALID_QUIZ_MEMBER_RESULT');
 const u=new URL(q.video_reference);if(u.protocol!=='https:'||u.username||u.password||u.port||['youtube.com','youtu.be'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('INVALID_QUIZ_MEMBER_RESULT');
 return {quiz_uuid:q.quiz_uuid.toLowerCase(),title:q.title,description:q.description,provider:'partner',video_reference:u.href,question_count:q.question_count,policy_version:q.policy_version,points:q.points,xp:q.xp,passing_percent:q.passing_percent,state:!payouts&&q.state==='available'?'paused':q.state};
}
function receipt(r){
 if(!r||!UUID.test(r.quiz_uuid||'')||!UUID.test(r.attempt_uuid||'')||!Number.isSafeInteger(r.score_correct)||!Number.isSafeInteger(r.question_count)||r.question_count<1||r.question_count>30||r.score_correct<0||r.score_correct>r.question_count||typeof r.passed!=='boolean'||!amount(r.points_awarded)||!amount(r.xp_awarded)||r.passed!==(r.operation_uuid!==null)||r.operation_uuid!==null&&!UUID.test(r.operation_uuid||'')||!r.passed&&(r.points_awarded!==0||r.xp_awarded!==0)||r.passed&&r.points_awarded+r.xp_awarded===0||!version(r.policy_version))throw Error('INVALID_QUIZ_MEMBER_RESULT');
 return {quiz_uuid:r.quiz_uuid.toLowerCase(),attempt_uuid:r.attempt_uuid,score_correct:r.score_correct,question_count:r.question_count,passed:r.passed,points_awarded:r.points_awarded,xp_awarded:r.xp_awarded,operation_uuid:r.operation_uuid,policy_version:r.policy_version};
}
export function projectRewardedQuizResult(r,b){
 if(!validRewardedQuizBody(b)||!r||typeof r.enabled!=='boolean')throw Error('INVALID_QUIZ_MEMBER_RESULT');
 if(!r.enabled){if(!['catalog','history'].includes(b.action)||r.read_only!==true||!Array.isArray(r.items)||r.items.length!==0)throw Error('INVALID_QUIZ_MEMBER_RESULT');return b.action==='catalog'?{enabled:false,read_only:true,payouts_enabled:false,items:[],next_quiz:null,reward_day:null,remaining:{points:0,xp:0}}:{enabled:false,read_only:true,items:[],next_cursor:null};}
 if(b.action==='submit'){
  const result=receipt(r);if(result.quiz_uuid!==b.quiz_uuid.toLowerCase()||result.policy_version!==b.policy_version||typeof r.already_submitted!=='boolean'||typeof r.reward_issued!=='boolean'||r.reward_issued!==(r.passed&&!r.already_submitted))throw Error('INVALID_QUIZ_MEMBER_RESULT');
  return {enabled:true,...result,already_submitted:r.already_submitted,reward_issued:r.reward_issued};
 }
 if(r.read_only!==true)throw Error('INVALID_QUIZ_MEMBER_RESULT');
 if(b.action==='history'){
  if(!Array.isArray(r.items)||r.items.length>b.limit||!cursor(r.next_cursor))throw Error('INVALID_QUIZ_MEMBER_RESULT');const items=r.items.map(item=>{const p=receipt(item);if(typeof item.title!=='string'||item.title.length>255||!utc(item.submitted_at)||item.reward_issued!==false)throw Error('INVALID_QUIZ_MEMBER_RESULT');return {...p,title:item.title,submitted_at:item.submitted_at,reward_issued:false};});if(new Set(items.map(i=>i.attempt_uuid)).size!==items.length)throw Error('INVALID_QUIZ_MEMBER_RESULT');return {enabled:true,read_only:true,items,next_cursor:r.next_cursor};
 }
 if(typeof r.payouts_enabled!=='boolean')throw Error('INVALID_QUIZ_MEMBER_RESULT');
 if(b.action==='catalog'){
  if(!Array.isArray(r.items)||r.items.length>b.limit||!(r.next_quiz===null||UUID.test(r.next_quiz||''))||typeof r.reward_day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.reward_day)||!Number.isFinite(Date.parse(r.reward_day))||new Date(r.reward_day).toISOString().slice(0,10)!==r.reward_day||!amount(r.remaining?.points)||!amount(r.remaining?.xp))throw Error('INVALID_QUIZ_MEMBER_RESULT');
  const items=r.items.map(q=>quiz(q,r.payouts_enabled));if(new Set(items.map(i=>i.quiz_uuid)).size!==items.length)throw Error('INVALID_QUIZ_MEMBER_RESULT');return {enabled:true,read_only:true,payouts_enabled:r.payouts_enabled,items,reward_day:r.reward_day,remaining:{points:r.remaining.points,xp:r.remaining.xp},next_quiz:r.next_quiz};
 }
 const q=quiz(r.quiz,r.payouts_enabled);
 if(!r.payouts_enabled||q.quiz_uuid!==b.quiz_uuid.toLowerCase()||q.state!=='available'||!Array.isArray(r.quiz.questions)||r.quiz.questions.length!==q.question_count)throw Error('INVALID_QUIZ_MEMBER_RESULT');
 const questions=r.quiz.questions.map(a=>{if(!UUID.test(a.question_uuid||'')||typeof a.text!=='string'||!a.text.trim()||a.text.length>2000||!Array.isArray(a.choices)||a.choices.length<2||a.choices.length>6||a.choices.some(c=>typeof c!=='string'||!c.trim()||c.length>500))throw Error('INVALID_QUIZ_MEMBER_RESULT');return {question_uuid:a.question_uuid.toLowerCase(),text:a.text,choices:[...a.choices]};});
 if(new Set(questions.map(a=>a.question_uuid)).size!==questions.length)throw Error('INVALID_QUIZ_MEMBER_RESULT');
 return {enabled:true,read_only:true,payouts_enabled:true,quiz:{...q,questions}};
}
