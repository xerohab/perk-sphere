import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {verifyTrustedRequest} from '../../shared/hmac.ts';
import {assertAccountEligible} from '../../shared/rewardPolicy.ts';
import {isProviderConfigured} from '../../shared/oauth.ts';
import {socialLinkEvidence} from '../../shared/socialEvidence.ts';
const PATH='/functions/trustedLaunchSource';
const headers={'Cache-Control':'no-store'};
const fail=(status,error)=>Response.json({ok:false,error},{status,headers});
// Signed read-only launch/source API. The extension configuration API keeps its
// existing URL and contract. Nonce storage is the only authentication-side write.
async function handleRequest(req){
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 try{
  const client=createClientFromRequest(req),admin=client.asServiceRole;
  const auth=await verifyTrustedRequest(req,admin,PATH);
  if(!auth.ok)return fail(auth.status,auth.code);
  const body=JSON.parse(auth.rawBody),action=body?.action;
  if(action==='launch_readiness'){
   if(Object.keys(body).join(',')!=='action')return fail(400,'invalid_request');
   const controls=await admin.entities.Setting.filter({key:'perk_sphere_balance_reset_freeze'});
   return Response.json({ok:true,data:{
    source_revision:'launch-source-v1',
    wallet_authoritative:secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true',
    legacy_writers_frozen:controls.some(row=>row.value==='true'),
    partner_link_rewards_enabled:secrets.get('PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED')==='true',
    new_member_wallets_enabled:secrets.get('PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED')==='true',
    social_source_enabled:secrets.get('PERKSPHERE_SOCIAL_LINK_SOURCE_ENABLED')==='true',
    social_claims_enabled:secrets.get('PERKSPHERE_SOCIAL_LINK_REWARDS_ENABLED')==='true',
    youtube_configuration_present:isProviderConfigured(secrets,'youtube'),
    x_configuration_present:isProviderConfigured(secrets,'x'),
    token_encryption_configuration_present:/^[a-f0-9]{64}$/i.test(secrets.get('OAUTH_TOKEN_ENCRYPTION_KEY')||''),
    provider_round_trips_verified:false
   }},{headers});
  }
  if(action==='social_link_evidence'){
   if(Object.keys(body).sort().join(',')!=='action,provider,user_reference')return fail(400,'invalid_request');
   return Response.json({ok:true,data:await socialLinkEvidence(admin,{provider:body.provider,userReference:body.user_reference})},{headers});
  }
  if(!['game_eligibility','wallet_enrollment'].includes(action)||Object.keys(body).sort().join(',')!=='action,user_reference'||
     typeof body.user_reference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(body.user_reference))return fail(400,'invalid_request');
  const member=await admin.entities.User.get(body.user_reference).catch(()=>null);
  const restrictions=member?await admin.entities.Restriction.filter({user_id:member.id}):[];
  let eligible=false;
  try{assertAccountEligible(member,restrictions,'earn rewards');eligible=member?.id===body.user_reference&&secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true';}catch{}
  if(action==='game_eligibility')return Response.json({ok:true,data:{user_reference:body.user_reference,eligible}},{headers});
  return Response.json({ok:true,data:{user_reference:body.user_reference,
   eligible:eligible&&secrets.get('PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED')==='true',
   registered_at:member?.created_date||null,
   zero_balances:!!member&&(member.points_balance??0)===0&&(member.loyalty_xp??0)===0
  }},{headers});
 }catch{return fail(503,'launch_source_unavailable');}
}
export default handleRequest;
if(typeof Deno!=='undefined')Deno.serve(handleRequest);
