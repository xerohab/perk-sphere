const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,HEX=/^[a-f0-9]{64}$/;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const amount=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const version=v=>Number.isSafeInteger(v)&&v>=0&&v<=2147483646;
export function validQuizPolicyBody(b){
 if(!b||typeof b!=='object'||Array.isArray(b))return false;
 if(b.action==='read_limits')return exact(b,['action']);
 if(b.action==='read_policy')return exact(b,['action','quiz_uuid'])&&UUID.test(b.quiz_uuid||'');
 if(b.action==='update_limits'){const p=b.limits;return exact(b,['action','limits'])&&exact(p,['version','enabled','daily_points_limit','daily_xp_limit'])&&version(p.version)&&typeof p.enabled==='boolean'&&amount(p.daily_points_limit)&&amount(p.daily_xp_limit)&&(!p.enabled||p.daily_points_limit+p.daily_xp_limit>0);}
 if(b.action==='update_policy'){const p=b.policy;return exact(b,['action','quiz_uuid','policy'])&&UUID.test(b.quiz_uuid||'')&&exact(p,['version','enabled','points','xp','passing_percent','reviewed_content_sha256'])&&version(p.version)&&typeof p.enabled==='boolean'&&amount(p.points)&&amount(p.xp)&&Number.isSafeInteger(p.passing_percent)&&p.passing_percent>=1&&p.passing_percent<=100&&(!p.enabled||p.points+p.xp>0)&&(HEX.test(p.reviewed_content_sha256||'')||!p.enabled&&p.reviewed_content_sha256===null);}
 return false;
}
const rowVersion=v=>Number.isSafeInteger(v)&&v>=0&&v<=2147483647;
function limits(r){
 if(!r||!rowVersion(r.version)||typeof r.enabled!=='boolean'||!amount(r.daily_points_limit)||!amount(r.daily_xp_limit)||r.version===0&&(r.enabled||r.daily_points_limit!==0||r.daily_xp_limit!==0)||r.enabled&&r.daily_points_limit+r.daily_xp_limit===0)throw Error('INVALID_QUIZ_POLICY_RESULT');
 return {version:r.version,enabled:r.enabled,daily_points_limit:r.daily_points_limit,daily_xp_limit:r.daily_xp_limit};
}
function policy(r){
 if(!r||!rowVersion(r.version)||typeof r.enabled!=='boolean'||!amount(r.points)||!amount(r.xp)||!Number.isSafeInteger(r.passing_percent)||r.passing_percent<1||r.passing_percent>100||r.version===0&&(r.enabled||r.points!==0||r.xp!==0||r.content_sha256!==null)||r.version>0&&!HEX.test(r.content_sha256||'')||r.enabled&&r.points+r.xp===0)throw Error('INVALID_QUIZ_POLICY_RESULT');
 return {version:r.version,enabled:r.enabled,points:r.points,xp:r.xp,passing_percent:r.passing_percent,content_sha256:r.content_sha256};
}
export function projectQuizPolicyResult(r,b){
 if(!validQuizPolicyBody(b)||!r)throw Error('INVALID_QUIZ_POLICY_RESULT');
 if(b.action==='read_limits'){if(typeof r.payouts_enabled!=='boolean')throw Error('INVALID_QUIZ_POLICY_RESULT');return {limits:limits(r.limits),payouts_enabled:r.payouts_enabled};}
 if(b.action==='read_policy'){
  if(r.quiz_uuid!==b.quiz_uuid.toLowerCase()||typeof r.source_eligible!=='boolean'||typeof r.published!=='boolean'||typeof r.payouts_enabled!=='boolean'||r.source_eligible&&(typeof r.title!=='string'||r.title.length>255||!Number.isSafeInteger(r.question_count)||r.question_count<1||r.question_count>30||!HEX.test(r.content_sha256||''))||!r.source_eligible&&(r.title!==null||r.question_count!==null||r.content_sha256!==null||r.published!==false))throw Error('INVALID_QUIZ_POLICY_RESULT');
  return {quiz_uuid:r.quiz_uuid,title:r.title,question_count:r.question_count,source_eligible:r.source_eligible,published:r.published,content_sha256:r.content_sha256,policy:policy(r.policy),limits:limits(r.limits),payouts_enabled:r.payouts_enabled};
 }
 if(r.updated!==true)throw Error('INVALID_QUIZ_POLICY_RESULT');
 if(b.action==='update_limits'){const p=limits(r.limits);if(p.version!==b.limits.version+1||['enabled','daily_points_limit','daily_xp_limit'].some(k=>p[k]!==b.limits[k]))throw Error('INVALID_QUIZ_POLICY_RESULT');return {updated:true,limits:p};}
 const p=policy(r.policy);
 if(r.quiz_uuid!==b.quiz_uuid.toLowerCase()||p.version!==b.policy.version+1||['enabled','points','xp','passing_percent'].some(k=>p[k]!==b.policy[k])||b.policy.reviewed_content_sha256!==null&&p.content_sha256!==b.policy.reviewed_content_sha256)throw Error('INVALID_QUIZ_POLICY_RESULT');
 return {updated:true,quiz_uuid:r.quiz_uuid,policy:p};
}
