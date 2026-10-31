import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {cashBudgetPence,projectCashBudgetRead,projectCashBudgetUpdate} from '../../shared/cashBudgetContract.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'},fail=(status,error)=>Response.json({error},{status,headers});
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 try{
  if(secrets.get('PERKSPHERE_CASH_BUDGET_ADMIN_ENABLED')!=='true')return fail(503,'cash_budget_admin_paused');
  const b=await req.json().catch(()=>null);
  if(!b||Array.isArray(b)||!['read','update'].includes(b.action))return fail(400,'invalid_request');
  const access=await authorize(createClientFromRequest(req),'rules.manage');
  if(access.error){access.error.headers.set('Cache-Control','no-store');return access.error;}
  const keys=Object.keys(b).sort().join(',');
  if(b.action==='read'){
   if(keys!=='action,limit,offset'||!Number.isSafeInteger(b.limit)||b.limit<1||b.limit>100||!Number.isSafeInteger(b.offset)||b.offset<0||b.offset>10000)return fail(400,'invalid_request');
  }else{
   if(keys!=='action,approved_limit_pence,enabled,expected_version,reason,reserve_reference'||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||b.expected_version>=4294967295||typeof b.enabled!=='boolean'||b.expected_version===0&&b.enabled||typeof b.reserve_reference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(b.reserve_reference)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000)return fail(400,'invalid_request');
   try{if(cashBudgetPence(b.approved_limit_pence)===0n)throw Error();}catch{return fail(400,'invalid_request');}
  }
  const result=await linuxTrustedPost('/v1/perk-sphere/cash-budget-admin',{...b,actor:{role:'admin',user_reference:String(access.user.id)}});
  if(!result.ok){
   const safe=['CASH_BUDGET_CONFLICT','CASH_BUDGET_BELOW_LIABILITY','CASH_BUDGET_RECONCILIATION_REQUIRED'];
   return fail(result.status===409?409:503,safe.includes(result.code)?result.code:'cash_budget_admin_unavailable');
  }
  return Response.json({data:b.action==='read'?projectCashBudgetRead(result.data,b):projectCashBudgetUpdate(result.data,b)},{headers});
 }catch{return fail(503,'cash_budget_admin_unavailable');}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);