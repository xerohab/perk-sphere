import {validQuizPolicyBody,projectQuizPolicyResult} from './quiz-policy-contract.js';
export async function requestQuizPolicy({base44,actorId,body,isCurrent=()=>true}){
 try{
  if(!isCurrent()||!validQuizPolicyBody(body))throw Error('UNAVAILABLE');
  const before=await base44.auth.me();if(!isCurrent()||before?.id!==actorId||before?.role!=='admin'||['disabled','suspended','banned'].includes(before?.account_status))throw Error('UNAVAILABLE');
  const response=await base44.functions.invoke('manageQuizRewardPolicies',body);
  if(!isCurrent())throw Error('UNAVAILABLE');
  const after=await base44.auth.me();if(!isCurrent()||after?.id!==actorId||after?.role!=='admin'||['disabled','suspended','banned'].includes(after?.account_status))throw Error('UNAVAILABLE');
  return projectQuizPolicyResult(response?.data?.data,body);
 }catch{throw Error('QUIZ_POLICY_REQUEST_UNCONFIRMED');}
}
export function quizPolicyInteger(value,{min=0,max=1000000}={}){
 if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))throw Error('INVALID_QUIZ_POLICY_INPUT');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('INVALID_QUIZ_POLICY_INPUT');return n;
}
