import {createClientFromRequest} from 'npm:@base44/sdk';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
async function perkSphereHandler(req) {
 const base44=createClientFromRequest(req);
 const auth=await authorize(base44,'rules.manage');
 if(auth.error)return auth.error;
 const body=await req.json().catch(()=>null);
 if(!body || !['list','update'].includes(body.action) || Object.keys(body).some(k=>!['action','policy','expected_version','reason'].includes(k)))return Response.json({error:'Invalid request'},{status:400});
 const payload=body.action==='list'?{action:'list'}:{action:'update',policy:body.policy,expected_version:body.expected_version,reason:body.reason};
 const result=await linuxTrustedPost('/v1/perk-sphere/partner-rewards/policy',{...payload,actor:{role:'admin',user_reference:auth.user.id}});
 if(!result.ok)return Response.json({error:'Partner reward rules unavailable',code:result.code},{status:result.status===409?409:503});
 return Response.json({ok:true,data:result.data});
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
