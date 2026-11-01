import test from 'node:test';import assert from 'node:assert/strict';
import {requestQuizPolicy,quizPolicyInteger} from '../src/lib/quiz-policy-client.js';
import {newQuizDraft,newQuizQuestion,quizDraftForCreate} from '../src/lib/quiz-draft.js';
const {createQuizPolicyAdminHandler:createHandler}=await import('../base44/shared/quizPolicyAdminHandler.ts');
const quiz='00000000-0000-4000-8000-000000000001';
const request=b=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)});
function fixture(){
 let user={id:'ADMIN',role:'admin'},allowed=true;const settings={PERKSPHERE_QUIZ_ADMIN_ENABLED:'true'},calls=[];
 const limits={version:1,enabled:false,daily_points_limit:20,daily_xp_limit:50};
 const options={getClient:()=>({}),getSecret:n=>settings[n],authorize:async(c,p)=>{assert.equal(p,'rules.manage');return allowed&&user?{user}:{error:Response.json({error:'forbidden'},{status:user?403:401})};},post:async(path,body)=>{
  calls.push({path,body});
  if(body.action==='read_limits')return {ok:true,data:{limits:{...limits},payouts_enabled:false,private_extra:'PRIVATE'}};
  if(body.action==='update_limits'){Object.assign(limits,body.limits,{version:body.limits.version+1});return {ok:true,data:{updated:true,limits:{...limits}}};}
  return {ok:true,data:{quiz_uuid:quiz,title:'Quiz',question_count:1,source_eligible:true,published:true,content_sha256:'a'.repeat(64),policy:{version:0,enabled:false,points:0,xp:0,passing_percent:100,content_sha256:null},limits:{...limits},payouts_enabled:false}};
 }};
 return {options,settings,calls,limits,setUser:v=>user=v,setAllowed:v=>allowed=v,auth:()=>user};
}
test('quiz admin gateway checks rules permission and active staff before Linux traffic',async()=>{
 for(const user of [null,{id:'MEMBER',role:'member'}]){const f=fixture();f.setUser(user);const r=await createHandler(f.options)(request({action:'read_limits'}));assert.equal(r.status,user?403:401);assert.equal(f.calls.length,0);assert.equal(r.headers.get('Cache-Control'),'no-store');}
 const f=fixture();f.setAllowed(false);assert.equal((await createHandler(f.options)(request({action:'read_limits'}))).status,403);assert.equal(f.calls.length,0);
});
test('quiz admin gateway defaults paused and rejects browser identity, extra fields and unsupported actions',async()=>{
 const f=fixture();delete f.settings.PERKSPHERE_QUIZ_ADMIN_ENABLED;assert.equal((await createHandler(f.options)(request({action:'read_limits'}))).status,503);assert.equal(f.calls.length,0);
 for(const b of [{action:'read_limits',actor:{role:'admin'}},{action:'read_limits',user_reference:'OTHER'},{action:'enable_all'},{action:'read_policy',quiz_uuid:'invalid'}]){
  const g=fixture();assert.equal((await createHandler(g.options)(request(b))).status,400);assert.equal(g.calls.length,0);
 }
});
test('quiz admin gateway signs only the server-derived actor at its fixed endpoint and strips extra data',async()=>{
 const f=fixture(),r=await createHandler(f.options)(request({action:'read_limits'})),data=(await r.json()).data;assert.equal(r.status,200);assert.deepEqual(f.calls[0],{path:'/v1/perk-sphere/quiz-rewards/admin',body:{action:'read_limits',actor:{role:'admin',user_reference:'ADMIN'}}});assert.doesNotMatch(JSON.stringify(data),/PRIVATE|private_extra/);
});
test('permission or switch loss before dispatch prevents policy changes',async()=>{
 for(const mode of ['actor','permission','switch']){
  const f=fixture(),authorize=f.options.authorize;let calls=0;f.options.authorize=async(...a)=>{if(++calls===2){if(mode==='actor')f.setUser({id:'OTHER',role:'admin'});if(mode==='permission')f.setAllowed(false);if(mode==='switch')f.settings.PERKSPHERE_QUIZ_ADMIN_ENABLED='false';}return authorize(...a);};
  assert.equal((await createHandler(f.options)(request({action:'update_limits',limits:{...f.limits}}))).status,503);assert.equal(f.calls.length,0);
 }
});
test('uncertain policy replies or a session change after dispatch never return success',async()=>{
 for(const mode of ['lost','actor','version']){
  const f=fixture(),post=f.options.post;f.options.post=async(...a)=>{const r=await post(...a);if(mode==='lost')throw Error('private token');if(mode==='actor')f.setUser({id:'OTHER',role:'admin'});if(mode==='version')r.data.limits.version=99;return r;};
  const r=await createHandler(f.options)(request({action:'update_limits',limits:{...f.limits}}));assert.equal(r.status,409);assert.equal((await r.json()).error,'quiz_policy_update_unconfirmed');assert.equal(f.calls.length,1);
 }
});
test('confirmed quiz policy saves require the exact next revision and values',async()=>{
 const f=fixture(),r=await createHandler(f.options)(request({action:'update_limits',limits:{...f.limits,daily_points_limit:10}}));assert.equal(r.status,200);const data=(await r.json()).data;assert.equal(data.updated,true);assert.equal(data.limits.version,2);assert.equal(data.limits.daily_points_limit,10);
});
test('version conflicts and internal failures are returned with safe fixed errors',async()=>{
 for(const [code,status,error] of [['QUIZ_POLICY_VERSION_CONFLICT',409,'QUIZ_POLICY_VERSION_CONFLICT'],['private-sql',503,'quiz_admin_unavailable']]){
  const f=fixture();f.options.post=async()=>({ok:false,code});const r=await createHandler(f.options)(request({action:'read_limits'}));assert.equal(r.status,status);assert.equal((await r.json()).error,error);
 }
});
function clientFixture(){
 const f=fixture(),handler=createHandler(f.options);let invokes=0;
 const base44={auth:{me:async()=>f.auth()},functions:{invoke:async(name,b)=>{invokes++;assert.equal(name,'manageQuizRewardPolicies');const r=await handler(request(b));if(!r.ok)throw Error('PRIVATE');return {data:await r.json()};}}};
 return {...f,base44,invokes:()=>invokes,args:{base44,actorId:'ADMIN',body:{action:'read_limits'}}};
}
test('quiz policy client runs the actual handler and validates source-scoped policy previews',async()=>{
 const f=clientFixture(),r=await requestQuizPolicy({...f.args,body:{action:'read_policy',quiz_uuid:quiz}});assert.equal(r.quiz_uuid,quiz);assert.equal(r.policy.version,0);assert.equal(r.policy.enabled,false);assert.equal(r.content_sha256,'a'.repeat(64));
});
test('quiz policy client rejects wrong sessions and stale results before rendering',async()=>{
 const f=clientFixture();f.setUser({id:'OTHER',role:'admin'});await assert.rejects(requestQuizPolicy(f.args));assert.equal(f.invokes(),0);
 for(const mode of ['actor','invalidated']){
  const g=clientFixture(),invoke=g.base44.functions.invoke;let current=true;g.base44.functions.invoke=async(...a)=>{const r=await invoke(...a);if(mode==='actor')g.setUser({id:'OTHER',role:'admin'});else current=false;return r;};await assert.rejects(requestQuizPolicy({...g.args,isCurrent:()=>current}),/^Error: QUIZ_POLICY_REQUEST_UNCONFIRMED$/);
 }
});
test('quiz policy client rejects foreign quiz snapshots and malformed policy data',async()=>{
 for(const mutate of [r=>r.quiz_uuid='00000000-0000-4000-8000-000000000002',r=>r.policy.enabled=true,r=>r.limits.daily_points_limit=-1]){
  const f=clientFixture(),invoke=f.base44.functions.invoke;f.base44.functions.invoke=async(...a)=>{const r=await invoke(...a);mutate(r.data.data);return r;};await assert.rejects(requestQuizPolicy({...f.args,body:{action:'read_policy',quiz_uuid:quiz}}));
 }
});
test('quiz policy forms accept only bounded whole amounts and explicit percentages',()=>{
 assert.equal(quizPolicyInteger('0'),0);assert.equal(quizPolicyInteger('100',{min:1,max:100}),100);
 for(const v of ['1.5','-1',' 2','2e2','01','1000001'])assert.throws(()=>quizPolicyInteger(v));assert.throws(()=>quizPolicyInteger('0',{min:1,max:100}));
});
test('quiz authoring normalizes YouTube IDs into backend-compatible URLs and preserves correct-answer indexes',()=>{
 const d=newQuizDraft();Object.assign(d,{title:'Quiz',video_ref:'abcdefghijk'});d.questions=[{text:'Question',choices:['One','Two'],correct_choice:1}];
 const r=quizDraftForCreate(d);assert.equal(r.video_ref,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(r.questions[0].correct_choice,1);assert.equal(r.partner_uuid,undefined);
 d.questions[0].choices=['','Two'];assert.throws(()=>quizDraftForCreate(d),/INVALID_QUIZ_DRAFT/);
});
test('partner authoring preserves provider UUID and HTTPS reference without passing reward or actor fields',()=>{
 const d={...newQuizDraft(),title:'Partner quiz',provider:'partner',partner_uuid:quiz,video_ref:'https://partner.invalid/quiz',points:999,actor:'OTHER',questions:[{text:'Q',choices:['A','B'],correct_choice:0}]};const r=quizDraftForCreate(d);assert.equal(r.provider,'partner');assert.equal(r.partner_uuid,quiz);assert.equal(r.video_ref,'https://partner.invalid/quiz');assert.equal(r.points,undefined);assert.equal(r.actor,undefined);
 for(const video_ref of ['javascript:alert(1)','https://user:pass@partner.invalid/quiz','https://www.youtube.com/watch?v=abcdefghijk'])assert.throws(()=>quizDraftForCreate({...d,video_ref}));
});
test('new quiz drafts have independent choice arrays and reject malformed answer keys',()=>{
 const a=newQuizDraft(),b=newQuizDraft();a.questions[0].choices[0]='changed';assert.equal(b.questions[0].choices[0],'');assert.notEqual(newQuizQuestion().choices,newQuizQuestion().choices);
 const d={...newQuizDraft(),title:'Quiz',video_ref:'abcdefghijk',questions:[{text:'Q',choices:['One','Two'],correct_choice:2}]};assert.throws(()=>quizDraftForCreate(d));
});
