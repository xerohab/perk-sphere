import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize,writeAudit} from '../../shared/permissions.ts';
import {loadBotSource,botSource,botPlan} from '../../shared/dailyTaskBot.ts';
async function handler(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const client=createClientFromRequest(req),body=await req.json();
  const auth=await authorize(client,body.action==='save'?'settings.manage':'tasks.view');if(auth.error)return auth.error;
  const admin=client.asServiceRole;
  if(body.action==='status'){const {source}=await loadBotSource(admin);return Response.json({ok:true,source,publication_mode:'private_drafts_only',schedule:'09:00 Europe/London daily'});}
  if(body.action==='preview')return Response.json({ok:true,...await botPlan(admin)});
  if(body.action==='save'){
   const source=botSource(body.source),{record}=await loadBotSource(admin);
   // Source records only configure the scanner. They cannot broaden adapters,
   // set reward amounts, publish tasks or change destination classification.
   if(record)await admin.entities.TaskBotSource.update(record.id,source);else await admin.entities.TaskBotSource.create(source);
   await writeAudit(admin,{adminId:auth.user.id,action:'task_bot_source_updated',entityType:'TaskBotSource',entityId:record?.id||'xerostreams',next:source});
   return Response.json({ok:true,source});
  }
  return Response.json({error:'Unknown action'},{status:400});
 }catch{return Response.json({error:'Task bot unavailable; check source controls and catalog connection.'},{status:503});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
