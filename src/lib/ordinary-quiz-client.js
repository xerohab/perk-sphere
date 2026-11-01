export async function ordinaryQuizRequest({base44,actorId,body,isCurrent=()=>true}){
 try{
  if(!isCurrent())throw Error('UNAVAILABLE');const before=await base44.auth.me();if(!isCurrent()||before?.id!==actorId||['disabled','suspended','banned'].includes(before?.account_status))throw Error('UNAVAILABLE');
  const r=await base44.functions.invoke('perkSphereQuizzes',body);
  if(!isCurrent())throw Error('UNAVAILABLE');const after=await base44.auth.me();if(!isCurrent()||after?.id!==actorId||['disabled','suspended','banned'].includes(after?.account_status))throw Error('UNAVAILABLE');
  return r;
 }catch{throw Error('QUIZ_REQUEST_UNAVAILABLE');}
}
