import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {secrets} from 'base44:runtime';
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,100}$/.test(v);
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  if(secrets.get('PERKSPHERE_VERIFIED_STREAK_ADMIN_ENABLED')!=='true')return Response.json({error:'streak_admin_paused'},{status:503,headers});
  const auth=await authorize(createClientFromRequest(req),'rules.manage');if(auth.error){auth.error.headers.set('Cache-Control','no-store');return auth.error;}
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b)||!ref(b.campaign_reference)||!['read','update'].includes(b.action))return Response.json({error:'invalid_request'},{status:400,headers});
  if(b.action==='read'&&Object.keys(b).sort().join(',')!=='action,campaign_reference')return Response.json({error:'invalid_request'},{status:400,headers});
  if(b.action==='update'&&(Object.keys(b).sort().join(',')!=='action,activity_after,campaign_reference,enabled,expected_version,points,task_references,xp'||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||typeof b.enabled!=='boolean'||!Array.isArray(b.task_references)||b.task_references.length<1||b.task_references.length>100||b.task_references.some(t=>typeof t!=='string'||!/^[a-f0-9]{24}$/.test(t))||new Set(b.task_references).size!==b.task_references.length||typeof b.activity_after!=='string'||![b.points,b.xp].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)||b.points+b.xp<1))return Response.json({error:'invalid_request'},{status:400,headers});
  const result=await linuxTrustedPost('/v1/perk-sphere/verified-streak-admin',{...b,actor:{role:'admin',user_reference:auth.user.id}});
  if(!result.ok)return Response.json({error:result.code||'streak_admin_unavailable'},{status:result.status,headers});
  return Response.json({data:result.data},{headers});
 }catch{return Response.json({error:'streak_admin_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
