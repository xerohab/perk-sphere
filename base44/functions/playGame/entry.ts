import {ensureLinuxWallet} from '../../shared/memberWalletEnrollment.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';
import { assertAccountEligible } from '../../shared/rewardPolicy.ts';
export default async function(req) {
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try {
  const base44=createClientFromRequest(req);
  const user=await base44.auth.me();
  if(!user?.id)return Response.json({error:'Sign in to play'},{status:401});
  const restrictions=await base44.asServiceRole.entities.Restriction.filter({user_id:user.id});
  try{assertAccountEligible(user,restrictions,'earn game rewards');}
  catch{return Response.json({error:'Account is restricted from earning game rewards'},{status:403});}
  const body=await req.json();
  const fields=body?.action==='start'?['action','game_reference']:['action','game_reference','session_uuid','round_number','answer'];
  if(!body || typeof body!=='object' || Array.isArray(body) || !['start','round'].includes(body.action) || !['number-memory','quick-maths','reverse-code'].includes(body.game_reference) ||
     Object.keys(body).sort().join(',')!==fields.sort().join(','))return Response.json({error:'Invalid game request'},{status:400});
  // Browser cannot choose member identity, reward amounts or elapsed time.
  await ensureLinuxWallet(user.id);
  const result=await linuxTrustedPost('/v1/perk-sphere/games/play',{...body,actor:{role:'member',user_reference:user.id}});
  if(!result.ok)return Response.json({error:result.code || 'Game rewards are temporarily unavailable'},{status:result.status});
  const data=result.data;
  if(!data || !['active','awarded'].includes(data.status) || data.game_reference!==body.game_reference ||
     !Number.isSafeInteger(data.eligible_seconds) || !Number.isSafeInteger(data.required_seconds) ||
     (data.status==='active' && (typeof data.challenge!=='string' || data.challenge.length>100)))return Response.json({error:'Invalid game response'},{status:502});
  return Response.json({data},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Unable to load game session'},{status:502});}
}