import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {requestRewardedQuiz} from '@/lib/rewarded-quiz-client';
const states={submitted:'Attempt already recorded',previous_attempt:'Previous practice attempt; no reward backfill',daily_limit:'Daily quiz limit reached',paused:'Quiz payouts paused',review_required:'Content awaiting review'};
function Panel({user}){
 const [catalog,setCatalog]=useState(null),[active,setActive]=useState(null),[answers,setAnswers]=useState({}),[pending,setPending]=useState(null),[result,setResult]=useState(null),[history,setHistory]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[pages,setPages]=useState([null]);
 const generation=useRef(0),running=useRef(false),mounted=useRef(false);
 const run=useCallback(async(body,apply)=>{
  if(running.current)return;running.current=true;setBusy(true);setMessage('');const current=++generation.current,valid=()=>mounted.current&&generation.current===current;
  try{const data=await requestRewardedQuiz({base44,actorId:user.id,body,isCurrent:valid});if(valid())apply(data);}
  catch{if(valid()){if(body.action!=='submit'){setCatalog(null);setHistory(null);setActive(null);}setMessage(body.action==='submit'?'The submission could not be confirmed. Your original answers are kept for an exact retry. Check reward history before starting again; no extra award is promised.':'Rewarded quizzes are unavailable. Refresh to check your current account and policy state.');}}
  finally{if(valid()){running.current=false;setBusy(false);}}
 },[user.id]);
 const loadCatalog=useCallback((after=null)=>run({action:'catalog',after_quiz:after,limit:20},r=>{setCatalog(r);setActive(null);setPending(null);setResult(null);setHistory(null);}),[run]);
 useEffect(()=>{mounted.current=true;loadCatalog();const clear=()=>{generation.current++;running.current=false;setBusy(false);setCatalog(r=>r?.enabled===false?r:null);setActive(null);setAnswers({});setPending(null);setResult(null);setHistory(null);setPages([null]);setMessage('Refresh to recheck quiz eligibility. If you were submitting, check reward history.');};window.addEventListener('focus',clear);document.addEventListener('visibilitychange',clear);return()=>{mounted.current=false;generation.current++;running.current=false;window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',clear);};},[loadCatalog]);
 const start=q=>run({action:'questions',quiz_uuid:q.quiz_uuid},r=>{setActive(r.quiz);setAnswers({});setPending(null);setResult(null);setHistory(null);});
 const loadHistory=before=>run({action:'history',before,limit:20},r=>{setHistory(r);setActive(null);setPending(null);setResult(null);});
 const submit=()=>{
  if(!active)return;const body=pending||{action:'submit',quiz_uuid:active.quiz_uuid,policy_version:active.policy_version,answers:active.questions.map(q=>({question_uuid:q.question_uuid,selected_index:answers[q.question_uuid]}))};
  if(!pending&&body.answers.some(a=>!Number.isSafeInteger(a.selected_index))){setMessage('Answer every question before submitting.');return;}
  setPending(body);run(body,r=>{setResult(r);setPending(null);});
 };
 if(catalog?.enabled===false)return null;
 return <section className="mb-6 space-y-4 rounded-xl border bg-card p-5">
  <h2 className="text-lg font-semibold">Rewarded knowledge quizzes</h2>
  <p className="text-sm text-muted-foreground">Answer eligible partner questions once per quiz. Only a passing server-graded attempt can earn the stated award, within shared daily limits. This does not verify watching a video. YouTube viewing earns no Points or XP.</p>
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{setPages([null]);loadCatalog();}}>Refresh rewarded quizzes</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>loadHistory(null)}>Quiz reward history</Button></div>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {busy&&<p role="status" className="text-sm">Checking quiz records…</p>}
  {result&&<div className="space-y-2 rounded border p-4"><p className="font-medium">Score: {result.score_correct}/{result.question_count}</p><p className="text-sm">{result.reward_issued?'Award recorded: '+result.points_awarded+' Points / '+result.xp_awarded+' XP.':result.already_submitted?'This attempt was already recorded. Original award: '+result.points_awarded+' Points / '+result.xp_awarded+' XP. No new reward was issued.':'The attempt did not pass. No reward was issued.'}</p><p className="text-xs text-muted-foreground">The ledger is authoritative. Refresh your wallet to see synchronized history.</p></div>}
  {active&&!result&&<div className="space-y-4"><h3 className="font-medium">{active.title}</h3><p className="text-sm">Pass threshold: {active.passing_percent}%. Award: {active.points} Points / {active.xp} XP. Policy version {active.policy_version}.</p>{active.questions.map((q,i)=><fieldset key={q.question_uuid} disabled={busy||!!pending} className="space-y-2 rounded border p-3"><legend className="px-1 text-sm font-medium">{i+1}. {q.text}</legend>{q.choices.map((choice,index)=><label key={index} className="flex cursor-pointer items-start gap-2 rounded border p-3 text-sm"><input type="radio" name={q.question_uuid} checked={answers[q.question_uuid]===index} onChange={()=>setAnswers(a=>({...a,[q.question_uuid]:index}))}/><span>{choice}</span></label>)}</fieldset>)}<Button disabled={busy} onClick={submit}>{pending?'Retry exact submission':'Submit rewarded quiz'}</Button></div>}
  {history&&<div className="space-y-3"><h3 className="font-medium">Recorded quiz rewards</h3>{history.items.length===0&&<p className="text-sm">No rewarded quiz attempts recorded.</p>}{history.items.map(r=><div key={r.attempt_uuid} className="rounded border p-3 text-sm"><p className="font-medium">{r.title}</p><p>Grade {r.score_correct}/{r.question_count}. Original award {r.points_awarded} Points / {r.xp_awarded} XP.</p><p className="text-xs text-muted-foreground">{r.submitted_at} · This history view issues no reward.</p></div>)}{history.next_cursor&&<Button variant="outline" disabled={busy} onClick={()=>loadHistory(history.next_cursor)}>Older reward records</Button>}</div>}
  {catalog?.enabled&&!active&&!history&&<><p className="text-sm">UTC day {catalog.reward_day}: {catalog.remaining.points} Points / {catalog.remaining.xp} XP remaining in shared quiz limits. Payout switch: {catalog.payouts_enabled?'enabled':'paused'}.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalog.items.map(q=><article key={q.quiz_uuid} className="space-y-2 rounded border p-4"><h3 className="font-medium">{q.title}</h3><p className="line-clamp-3 text-sm text-muted-foreground">{q.description}</p><p className="text-sm">{q.question_count} questions · pass {q.passing_percent}% · {q.points} Points / {q.xp} XP</p>{q.state!=='available'&&<p className="text-sm">{states[q.state]}</p>}<Button disabled={busy||q.state!=='available'} onClick={()=>start(q)}>Take rewarded quiz</Button></article>)}</div>{catalog.items.length===0&&<p className="text-sm">No eligible rewarded quizzes on this page.</p>}<div className="flex gap-2">{pages.length>1&&<Button variant="outline" disabled={busy} onClick={()=>{const next=pages.slice(0,-1);setPages(next);loadCatalog(next.at(-1));}}>Previous quizzes</Button>}{catalog.next_quiz&&<Button variant="outline" disabled={busy} onClick={()=>{setPages(p=>[...p,catalog.next_quiz]);loadCatalog(catalog.next_quiz);}}>More quizzes</Button>}</div></>}
 </section>;
}
export default function RewardedQuizzes(){
 const {user}=useAuth();if(!user?.id||['disabled','suspended','banned'].includes(user.account_status))return null;
 return <Panel key={JSON.stringify([user.id,user.role,user.account_status])} user={user}/>;
}
