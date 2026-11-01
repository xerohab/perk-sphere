export async function readLaunchReadiness({base44,actorId,isCurrent=()=>true}){
 const active=u=>typeof actorId==='string'&&actorId.length>0&&u?.id===actorId&&u.role==='admin'&&!['disabled','suspended','banned'].includes(u.account_status);
 try{
  if(!isCurrent()||!active(await base44.auth.me())||!isCurrent())throw Error('UNAVAILABLE');
  const response=await base44.functions.invoke('getCoreLaunchReadiness',{});
  if(!isCurrent()||!active(await base44.auth.me())||!isCurrent())throw Error('UNAVAILABLE');
  const data=response?.data?.data;
  if(data?.report_version!==1||data.acceptance_verified!==false||typeof data.configuration_complete!=='boolean'||!data.checks||Object.values(data.checks).some(v=>typeof v!=='boolean')||data.configuration_complete!==Object.values(data.checks).every(Boolean))throw Error('UNAVAILABLE');
  return data;
 }catch{throw Error('LAUNCH_READINESS_UNAVAILABLE');}
}
