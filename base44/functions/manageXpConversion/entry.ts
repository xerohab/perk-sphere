import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {secrets} from 'base44:runtime';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  if(secrets.get('PERKSPHERE_XP_CONVERSION_ADMIN_ENABLED')!=='true')return Response.json({error:'xp_conversion_admin_paused'},{status:503,headers});
  const auth=await authorize(createClientFromRequest(req),'rules.manage');if(auth.error){auth.error.headers.set('Cache-Control','no-store');return auth.error;}
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b)||!['read','update'].includes(b.action))return Response.json({error:'invalid_request'},{status:400,headers});
  if(b.action==='read'&&Object.keys(b).join(',')!=='action')return Response.json({error:'invalid_request'},{status:400,headers});
  if(b.action==='update'&&(Object.keys(b).sort().join(',')!=='action,enabled,expected_version,input_xp,output_points'||typeof b.enabled!=='boolean'||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||![b.input_xp,b.output_points].every(x=>Number.isSafeInteger(x)&&x>0&&x<=1000000000)))return Response.json({error:'invalid_request'},{status:400,headers});
  const result=await linuxTrustedPost('/v1/perk-sphere/xp-conversion-admin',{...b,actor:{role:'admin',user_reference:auth.user.id}});
  if(!result.ok)return Response.json({error:result.code||'xp_conversion_admin_unavailable'},{status:result.status,headers});
  return Response.json({data:result.data},{headers});
 }catch{return Response.json({error:'xp_conversion_admin_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
