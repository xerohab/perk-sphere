import {validRewardedQuizBody,projectRewardedQuizResult} from './rewarded-quiz-contract.js';
export async function requestRewardedQuiz({base44,actorId,body,isCurrent=()=>true}){
 try{
  if(!isCurrent()||!validRewardedQuizBody(body))throw Error('UNAVAILABLE');
  const before=await base44.auth.me();if(!isCurrent()||before?.id!==actorId||['disabled','suspended','banned'].includes(before?.account_status))throw Error('UNAVAILABLE');
  const response=await base44.functions.invoke('perkSphereRewardedQuizzes',body);
  if(!isCurrent())throw Error('UNAVAILABLE');const after=await base44.auth.me();if(!isCurrent()||after?.id!==actorId||['disabled','suspended','banned'].includes(after?.account_status))throw Error('UNAVAILABLE');
  return projectRewardedQuizResult(response?.data?.data,body);
 }catch{throw Error(body?.action==='submit'?'QUIZ_SUBMISSION_UNCONFIRMED':'REWARDED_QUIZ_UNAVAILABLE');}
}
