import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {ensureLinuxWallet} from '../../shared/memberWalletEnrollment.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const user=await createClientFromRequest(req).auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  if(['disabled','suspended','banned'].includes(user.account_status))return Response.json({error:'account_unavailable'},{status:403,headers});
  let enabled=false;try{enabled=secrets.get('PERKSPHERE_DAILY_LOGIN_ENABLED')==='true';}catch{}
  if(!enabled)return Response.json({enabled:false},{headers});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({error:'invalid_request'},{status:400,headers});
  await ensureLinuxWallet(user.id);
  const result=await linuxTrustedPost('/v1/perk-sphere/daily-login/status',{actor:{role:'member',user_reference:user.id}});
  const d=result.data;
  if(!result.ok||d?.enabled!==true||typeof d.claimed!=='boolean'||typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day)||typeof d.penalty_enabled!=='boolean')throw Error('INVALID_STATUS');
  if(d.penalty_enabled&&(!Number.isSafeInteger(d.points_deducted)||d.points_deducted<0||d.penalty_points_per_day!==1))throw Error('INVALID_POLICY');
  return Response.json({enabled:true,user_reference:String(user.id),day:d.day,claimed:d.claimed,penalty_enabled:d.penalty_enabled,penalty_points_per_day:d.penalty_enabled?1:0,points_deducted:d.points_deducted||0},{headers});
 }catch{return Response.json({error:'daily_status_unavailable'},{status:503,headers});}
}
export default handler;
if(typeof Deno!=='undefined')Deno.serve(handler);