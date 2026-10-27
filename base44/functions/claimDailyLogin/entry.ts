import {ensureLinuxWallet} from '../../shared/memberWalletEnrollment.ts';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {assertAccountEligible} from '../../shared/rewardPolicy.ts';
import {secrets} from 'base44:runtime';
// Disabled by default until Linux is deployed and the launch policy is approved.
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  if(secrets.get('PERKSPHERE_DAILY_LOGIN_ENABLED')!=='true')return Response.json({error:'daily_login_paused'},{status:503,headers});
  const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  const body=await req.json().catch(()=>null);
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length)return Response.json({error:'invalid_request'},{status:400,headers});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'earn daily login rewards');}catch{return Response.json({error:'account_restricted'},{status:403,headers});}
  await ensureLinuxWallet(user.id);
  const result=await linuxTrustedPost('/v1/perk-sphere/daily-login',{actor:{role:'member',user_reference:user.id}});
  if(!result.ok)return Response.json({error:'daily_login_unavailable'},{status:503,headers});
  const d=result.data;
  if(d?.enabled!==true||d.points!==1||typeof d.duplicate!=='boolean'||typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day))throw Error('INVALID_RESPONSE');
  return Response.json({data:{day:d.day,points:d.points,duplicate:d.duplicate}},{headers});
 }catch{return Response.json({error:'daily_login_unavailable'},{status:503,headers});}
}
export default handler;
if(typeof Deno!=='undefined')Deno.serve(handler);
