import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
const amount=v=>Number.isSafeInteger(v)&&v>0&&v<=1000000000;
const version=v=>Number.isSafeInteger(v)&&v>0&&v<=4294967295;
async function handler(req){
 const headers={'Cache-Control':'no-store'},fail=(status,error)=>Response.json({error},{status,headers});
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 try{
  if(secrets.get('PERKSPHERE_CASH_POLICY_ADMIN_ENABLED')!=='true')return fail(503,'cash_policy_admin_paused');
  const b=await req.json().catch(()=>null);
  if(!b||Array.isArray(b)||!['read','update'].includes(b.action))return fail(400,'invalid_request');
  const access=await authorize(createClientFromRequest(req),b.action==='read'?'rules.view':'rules.manage');
  if(access.error){access.error.headers.set('Cache-Control','no-store');return access.error;}
  const keys=Object.keys(b).sort().join(',');
  if(b.action==='read'?keys!=='action':keys!=='action,enabled,expected_version,input_points,output_pence,reason'||typeof b.enabled!=='boolean'||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||b.expected_version>=4294967295||!amount(b.input_points)||!amount(b.output_pence)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000||b.expected_version===0&&b.enabled)return fail(400,'invalid_request');
  const result=await linuxTrustedPost('/v1/perk-sphere/cash-admin',{...b,actor:{role:'admin',user_reference:String(access.user.id)}});
  if(!result.ok)return fail(result.status===409?409:503,result.status===409?'cash_policy_conflict':'cash_policy_admin_unavailable');
  const d=result.data;
  if(b.action==='read'){
   if(d?.configured===false)return Response.json({data:{configured:false},can_manage:access.staff.permissions.includes('rules.manage')},{headers});
   if(d?.configured!==true||typeof d.enabled!=='boolean'||!version(d.version)||!amount(d.input_points)||!amount(d.output_pence)||d.currency!=='GBP')throw Error('INVALID_POLICY');
   return Response.json({data:{configured:true,enabled:d.enabled,version:d.version,input_points:d.input_points,output_pence:d.output_pence,currency:'GBP'},can_manage:access.staff.permissions.includes('rules.manage')},{headers});
  }
  const p=d?.policy;
  if(d?.updated!==true||d.member_gate_changed!==false||d.payout_sent!==false||p?.enabled!==b.enabled||p.version!==b.expected_version+1||p.input_points!==String(b.input_points)||p.output_pence!==String(b.output_pence))throw Error('INVALID_POLICY');
  return Response.json({data:{updated:true,policy:{enabled:p.enabled,version:p.version,input_points:p.input_points,output_pence:p.output_pence},member_gate_changed:false,payout_sent:false}},{headers});
 }catch{return fail(503,'cash_policy_admin_unavailable');}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);