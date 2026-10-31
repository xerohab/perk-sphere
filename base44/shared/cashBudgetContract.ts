const MAX=18446744073709551615n;
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function cashBudgetPence(v){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(v)||BigInt(v)>MAX)throw Error('INVALID_BUDGET');return BigInt(v);}
export function projectCashBudget(v){
 if(!v||typeof v.enabled!=='boolean'||!Number.isSafeInteger(v.version)||v.version<1||v.version>4294967295||!ref(v.reserve_reference))throw Error('INVALID_BUDGET');
 const limit=cashBudgetPence(v.approved_limit_pence),allocated=cashBudgetPence(v.allocated_pence);if(limit===0n||allocated>limit)throw Error('INVALID_BUDGET');
 return {enabled:v.enabled,version:v.version,approved_limit_pence:limit.toString(),allocated_pence:allocated.toString(),reserve_reference:v.reserve_reference};
}
export function projectCashBudgetRead(v,{limit,offset}){
 if(!v||typeof v.configured!=='boolean'||v.currency!=='GBP'||v.limit!==limit||v.offset!==offset||typeof v.has_more!=='boolean'||!Array.isArray(v.history)||v.history.length>limit||v.provider_funding_verified!==false||v.member_gate_changed!==false||v.payout_sent!==false)throw Error('INVALID_BUDGET');
 const budget=v.configured?projectCashBudget(v.budget):null;
 if(budget?v.remaining_pence!==(BigInt(budget.approved_limit_pence)-BigInt(budget.allocated_pence)).toString():v.budget!==null||v.remaining_pence!==null)throw Error('INVALID_BUDGET');
 const history=v.history.map(r=>{
  if(!r||!uuid(r.audit_uuid)||!ref(r.actor_reference)||typeof r.reason!=='string'||r.reason.trim().length<5||r.reason.length>1000||typeof r.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(r.created_at)||!Number.isFinite(Date.parse(r.created_at)))throw Error('INVALID_BUDGET');
  const before=r.before===null?null:projectCashBudget(r.before),after=projectCashBudget(r.after);
  if(after.version!==(before?before.version+1:1)||before&&after.allocated_pence!==before.allocated_pence||!before&&after.allocated_pence!=='0')throw Error('INVALID_BUDGET');
  return {audit_uuid:r.audit_uuid,actor_reference:r.actor_reference,reason:r.reason,before,after,created_at:r.created_at};
 });
 if(new Set(history.map(r=>r.audit_uuid)).size!==history.length)throw Error('INVALID_BUDGET');
 return {configured:v.configured,currency:'GBP',budget,remaining_pence:v.remaining_pence,history,limit,offset,has_more:v.has_more,provider_funding_verified:false,member_gate_changed:false,payout_sent:false};
}
export function projectCashBudgetUpdate(v,request){
 if(v?.updated!==true||v.provider_funding_verified!==false||v.member_gate_changed!==false||v.payout_sent!==false)throw Error('INVALID_BUDGET');
 const budget=projectCashBudget(v.budget);
 if(budget.version!==request.expected_version+1||budget.enabled!==request.enabled||budget.approved_limit_pence!==request.approved_limit_pence||budget.reserve_reference!==request.reserve_reference)throw Error('INVALID_BUDGET');
 return {updated:true,budget,provider_funding_verified:false,member_gate_changed:false,payout_sent:false};
}
