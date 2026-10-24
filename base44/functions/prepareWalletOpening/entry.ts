import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {authorize,writeAudit} from '../../shared/permissions.ts';
import {FREEZE_KEY} from '../../shared/launchBalanceReset.ts';
async function perkSphereHandler(req) {
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),auth=await authorize(client,'points.adjust');
  if(auth.error)return auth.error;
  if(!auth.staff.permissions.includes('xp.adjust'))return Response.json({error:'Forbidden'},{status:403,headers});
  if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true')return Response.json({error:'The Linux wallet is already authoritative.'},{status:409,headers});
  const body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body)||!['freeze','export','resume'].includes(body.action)||Object.keys(body).some(key=>!['action','offset'].includes(key)))return Response.json({error:'Invalid request'},{status:400,headers});
  const offset=body.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%25!==0)return Response.json({error:'Invalid page'},{status:400,headers});
  const admin=client.asServiceRole,settings=await admin.entities.Setting.filter({key:FREEZE_KEY});
  if(settings.length>1)return Response.json({error:'Duplicate earning controls require review.'},{status:409,headers});
  if(body.action==='freeze'||body.action==='resume'){
   const value=body.action==='freeze'?'true':'false';
   await writeAudit(admin,{adminId:auth.user.id,action:'wallet_opening_'+body.action+'_requested',entityType:'Setting',next:{key:FREEZE_KEY,value}});
   if(settings.length)await admin.entities.Setting.update(settings[0].id,{value});else await admin.entities.Setting.create({key:FREEZE_KEY,value,category:'launch',description:'Pause legacy reward writers during preserved wallet cutover.'});
   return Response.json({frozen:value==='true',balances_changed:false},{headers});
  }
  if(!settings.some(row=>row.value==='true'))return Response.json({error:'Pause earning before exporting opening balances.'},{status:409,headers});
  const users=await admin.entities.User.list('id',25,offset),members=[];
  for(const user of users){
   const points=user.points_balance??0,xp=user.loyalty_xp??0;
   if(!Number.isSafeInteger(points)||!Number.isSafeInteger(xp)||points<0)throw Error('Opening balances require review; no balances were changed.');
   const status=user.account_status||'active';if(!['active','restricted','suspended','banned'].includes(status))throw Error('Account status requires review.');
   members.push({member_reference:user.id,points:String(points),xp:String(xp),account_status:status});
  }
  return Response.json({members,legacy_writers_frozen:true,verified_at:new Date().toISOString(),next_offset:offset+25,done:users.length<25},{headers});
 }catch{return Response.json({error:'Opening preparation could not complete. Existing balances are preserved.'},{status:409,headers});}
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
