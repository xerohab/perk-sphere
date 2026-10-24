import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
async function perkSphereHandler(req) {
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),body=await req.json();
  const action=body?.action;
  if(!['list','update'].includes(action)||Object.keys(body).sort().join(',')!==(action==='list'?'action':'action,policy,reason'))return Response.json({ok:false,error:'invalid_request'},{status:400,headers});
  const auth=await authorize(client,action==='list'?'rules.view':'rules.manage');if(auth.error)return auth.error;
  const actor={role:'admin',user_reference:String(auth.user.id)};
  const result=await linuxTrustedPost('/v1/perk-sphere/social-rewards/policy',{action,actor,...(action==='update'?{policy:body.policy,reason:body.reason}:{})});
  if(!result.ok)return Response.json({ok:false,error:result.code==='SOCIAL_POLICY_CONFLICT'?'SOCIAL_POLICY_CONFLICT':'social_policy_unavailable'},{status:result.status===409?409:503,headers});
  return Response.json({ok:true,data:result.data},{headers});
 }catch{return Response.json({ok:false,error:'social_policy_unavailable'},{status:503,headers});}
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
