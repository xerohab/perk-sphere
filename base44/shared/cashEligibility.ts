import {isRestrictionActive} from './rewardPolicy.ts';
const actions=['wallet','policy','convert','reserve','release'];
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(value);
export async function readCashEligibility(admin,{userReference,operation},{getSecret,clock=Date.now}){
 if(!ref(userReference)||!actions.includes(operation))throw Error('INVALID_CASH_ELIGIBILITY');
 const result={user_reference:userReference,operation,eligible:false};
 if(getSecret('PERKSPHERE_CASH_SOURCE_ENABLED')!=='true'||getSecret('PERKSPHERE_CASH_MEMBER_ENABLED')!=='true'||getSecret('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true')return result;
 const member=await admin.entities.User.get(userReference).catch(()=>null);
 if(!member||member.id!==userReference||['disabled','banned','suspended'].includes(member.account_status))return result;
 const now=clock();if(!Number.isSafeInteger(now))throw Error('INVALID_CASH_CLOCK');
 if(!['wallet','policy','release'].includes(operation)){
  const restrictions=await admin.entities.Restriction.filter({user_id:member.id},'-created_date',201);
  if(!Array.isArray(restrictions)||restrictions.length>200||restrictions.some(r=>!r||typeof r!=='object'||r.user_id!==member.id||typeof r.type!=='string'))throw Error('CASH_RESTRICTIONS_UNAVAILABLE');
  const blocked=['account_review','temporary_suspension','redemption_disabled','cash_operations_paused',...(operation==='convert'?['points_earning_paused','xp_earning_paused','cash_conversion_disabled']:['withdrawal_disabled'])];
  if(restrictions.some(r=>blocked.includes(r.type)&&isRestrictionActive(r,new Date(now))))return result;
 }
 return {...result,eligible:true};
}
