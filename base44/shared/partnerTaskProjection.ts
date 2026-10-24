// A projection of an already committed Linux award. This never adjusts balances.
export async function projectPartnerTaskAward(admin,body){
 let task;try{task=await admin.entities.Task.get(body.task_reference);}catch(error){if(error?.status===404||error?.response?.status===404)return {projected:false};throw error;}
 if(!task||task.id!==body.task_reference||task.reward_processing!=='linux_partner')return {projected:false};
 const records=await admin.entities.TaskProgress.filter({user_id:body.user_reference,task_id:body.task_reference});
 const points=Number(body.points_delta),xp=Number(body.xp_delta);
 if(!Number.isSafeInteger(points)||!Number.isSafeInteger(xp)||points<0||xp<0||points>1000000||xp>1000000)throw Error('INVALID_TASK_AWARD');
 const same=records.filter(row=>row.ledger_operation_uuid===body.operation_uuid);
 if(same.length){
  if(same.some(row=>!row.reward_issued||row.status!=='completed'||row.points_issued!==points||row.xp_issued!==xp))throw Error('TASK_PROJECTION_CONFLICT');
  return {projected:true,duplicate:true};
 }
 if(records.some(row=>row.reward_issued))throw Error('TASK_PROJECTION_CONFLICT');
 const target=records.filter(row=>row.status==='in_progress').sort((a,b)=>String(b.created_date||'').localeCompare(String(a.created_date||'')))[0];
 const data={user_id:body.user_reference,task_id:body.task_reference,task_name:task.name,status:'completed',progress_percentage:100,
  completed_at:new Date().toISOString(),reward_issued:true,points_issued:points,xp_issued:xp,completion_number:1,verification_status:'verified',
  source:task.task_type==='watch_video'?'linux_partner_client_assisted':'linux_partner_provider',ledger_operation_uuid:body.operation_uuid};
 if(target)await admin.entities.TaskProgress.update(target.id,data);else await admin.entities.TaskProgress.create(data);
 return {projected:true,duplicate:false};
}
