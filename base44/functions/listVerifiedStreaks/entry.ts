import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {assertAccountEligible} from '../../shared/rewardPolicy.ts';
import {secrets} from 'base44:runtime';
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,100}$/.test(v);
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  if(secrets.get('PERKSPHERE_VERIFIED_STREAK_ENABLED')!=='true')return Response.json({error:'streak_paused'},{status:503,headers});
  const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length)return Response.json({error:'invalid_request'},{status:400,headers});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'view activity bonuses');}catch{return Response.json({error:'account_restricted'},{status:403,headers});}
  const result=await linuxTrustedPost('/v1/perk-sphere/verified-streak/campaigns',{actor:{role:'member',user_reference:user.id}});
  if(!result.ok||!Array.isArray(result.data)||result.data.length>50)throw Error('INVALID_RESPONSE');
  const campaigns=result.data.map(c=>{
   if(!c||!ref(c.account_reference)||!ref(c.campaign_reference)||!Array.isArray(c.task_references)||!c.task_references.length||c.task_references.length>100||c.task_references.some(x=>typeof x!=='string'||!/^[a-f0-9]{24}$/.test(x))||new Set(c.task_references).size!==c.task_references.length||![c.points,c.xp].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000)||c.points+c.xp===0||typeof c.activity_after!=='string'||!Number.isFinite(Date.parse(c.activity_after)))throw Error('INVALID_CAMPAIGN');
   return {account_reference:c.account_reference,campaign_reference:c.campaign_reference,task_references:c.task_references,activity_after:c.activity_after,points:c.points,xp:c.xp};
  });
  return Response.json({data:campaigns},{headers});
 }catch{return Response.json({error:'streak_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
