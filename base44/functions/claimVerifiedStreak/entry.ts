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
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).sort().join(',')!=='account_reference,campaign_reference'||!ref(b.account_reference)||!ref(b.campaign_reference))return Response.json({error:'invalid_request'},{status:400,headers});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'earn activity bonuses');}catch{return Response.json({error:'account_restricted'},{status:403,headers});}
  const result=await linuxTrustedPost('/v1/perk-sphere/verified-streak/claim',{actor:{role:'member',user_reference:user.id},account_reference:b.account_reference,campaign_reference:b.campaign_reference});
  if(!result.ok)return Response.json({error:'streak_unavailable'},{status:503,headers});
  const d=result.data;
  if(!d||typeof d.issued!=='boolean'||d.duplicate!==undefined&&typeof d.duplicate!=='boolean'||d.reason!==undefined&&typeof d.reason!=='string')throw Error('INVALID_RESPONSE');
  return Response.json({data:{issued:d.issued,...(d.duplicate===true?{duplicate:true}:{}),...(typeof d.reason==='string'?{reason:d.reason}:{})}},{headers});
 }catch{return Response.json({error:'streak_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
