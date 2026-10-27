import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {assertAccountEligible} from '../../shared/rewardPolicy.ts';
import {secrets} from 'base44:runtime';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  if(secrets.get('PERKSPHERE_XP_CONVERSION_ENABLED')!=='true')return Response.json({error:'xp_conversion_paused'},{status:503,headers});
  const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body)||!['policy','convert'].includes(body.action))return Response.json({error:'invalid_request'},{status:400,headers});
  const validPolicy=body.action==='policy'&&Object.keys(body).join(',')==='action';
  const validConversion=body.action==='convert'&&Object.keys(body).sort().join(',')==='action,policy_version,request_reference,xp'&&uuid(body.request_reference)&&Number.isSafeInteger(body.xp)&&body.xp>0&&Number.isSafeInteger(body.policy_version)&&body.policy_version>0;
  if(!validPolicy&&!validConversion)return Response.json({error:'invalid_request'},{status:400,headers});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'convert XP');}catch{return Response.json({error:'account_restricted'},{status:403,headers});}
  const actor={role:'member',user_reference:user.id};
  const request=validPolicy?{actor}:{actor,request_reference:body.request_reference,xp:body.xp,policy_version:body.policy_version};
  const result=await linuxTrustedPost('/v1/perk-sphere/xp-conversion/'+body.action,request);
  if(!result.ok)return Response.json({error:'xp_conversion_unavailable'},{status:503,headers});
  const data=result.data;
  if(validPolicy){if(!data||![data.version,data.input_xp,data.output_points].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('INVALID_RESPONSE');return Response.json({data},{headers});}
  if(!data||typeof data.duplicate!=='boolean'||!uuid(data.operationUuid)||!/^\d+$/.test(data.xpSpent||'')||!/^\d+$/.test(data.pointsCredited||''))throw Error('INVALID_RESPONSE');
  return Response.json({data:{duplicate:data.duplicate,xp_spent:data.xpSpent,points_credited:data.pointsCredited}},{headers});
 }catch{return Response.json({error:'xp_conversion_unavailable'},{status:503,headers});}
}
export default handler;
if(typeof Deno!=='undefined')Deno.serve(handler);
