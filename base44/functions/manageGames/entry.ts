import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
async function perkSphereHandler(req) {
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const base44=createClientFromRequest(req);
  const auth=await authorize(base44,'tasks.edit');
  if(auth.error)return auth.error;
  const body=await req.json();
  if(!body || typeof body!=='object' || Array.isArray(body) || !['list','update'].includes(body.action) ||
     Object.keys(body).sort().join(',')!==(body.action==='list'?'action':'action,policy'))return Response.json({error:'Invalid game policy request'},{status:400});
  const result=await linuxTrustedPost('/v1/perk-sphere/games/policy',{...body,actor:{role:'admin',user_reference:auth.user.id}});
  if(!result.ok)return Response.json({error:result.code || 'Game policy unavailable'},{status:result.status});
  return Response.json({data:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Game policy unavailable'},{status:502});}
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
