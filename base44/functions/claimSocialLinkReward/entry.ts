import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
export default async function(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({ok:false,error:'unauthorized'},{status:401,headers});
  const body=await req.json().catch(()=>null);
  if(!body||Array.isArray(body)||Object.keys(body).join(',')!=='provider'||!['youtube','x'].includes(body.provider))
   return Response.json({ok:false,error:'invalid_request'},{status:400,headers});
  if(secrets.get('PERKSPHERE_SOCIAL_LINK_REWARDS_ENABLED')!=='true'||secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true')
   return Response.json({ok:true,data:{issued:false,reason:'social_rewards_disabled'}},{headers});
  const result=await linuxTrustedPost('/v1/perk-sphere/social-rewards/claim-link',{provider:body.provider,actor:{role:'member',user_reference:String(user.id)}});
  if(!result.ok)return Response.json({ok:false,error:'social_reward_unavailable'},{status:503,headers});
  return Response.json({ok:true,data:result.data},{headers});
 }catch{return Response.json({ok:false,error:'social_reward_unavailable'},{status:503,headers});}
}
