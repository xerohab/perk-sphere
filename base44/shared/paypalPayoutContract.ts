const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(v);
const exact=(v,k)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===k;
const fail=()=>{throw Error('INVALID_PAYOUT');};
const pence=v=>typeof v==='string'&&/^[1-9][0-9]{3,12}$/.test(v)&&BigInt(v)>=5000n&&BigInt(v)<=1000000000000n;
const email=v=>typeof v==='string'&&v.length<=254&&v===v.toLowerCase()&&!v.includes('..')&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(v);
const utc=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function paypalPayoutCommand(b,admin=false){
 if(b?.action==='list'){if(!exact(b,'action,limit,offset')||!Number.isSafeInteger(b.limit)||b.limit<1||b.limit>25||!Number.isSafeInteger(b.offset)||b.offset<0||b.offset>10000)fail();return {...b};}
 if(!admin&&b?.action==='submit'){if(!exact(b,'action,amount_pence,paypal_email,request_reference')||!uuid(b.request_reference)||!pence(b.amount_pence)||!email(b.paypal_email))fail();return {...b};}
 const paid=b?.action==='sent',keys=(admin?'user_reference,':'')+(paid?'action,amount_pence,expected_version,paypal_email,paypal_transaction_id,payout_uuid,reason':'action,expected_version,payout_uuid,reason');
 if(!b||!exact(b,keys.split(',').sort().join(','))||!(admin?['claim','reject','sent']:['cancel']).includes(b.action)||!uuid(b.payout_uuid)||!Number.isSafeInteger(b.expected_version)||b.expected_version<1||b.expected_version>=4294967295||admin&&!ref(b.user_reference)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000||/[\x00-\x1f\x7f]/.test(b.reason)||paid&&(!pence(b.amount_pence)||!email(b.paypal_email)||!/^[A-Z0-9]{17}$/.test(b.paypal_transaction_id||'')))fail();return {...b,reason:b.reason.trim()};
}
export function projectPaypalPayout(r,admin=false){
 const keys='amount_pence,automatically_sent,created_at,currency,due_at,paypal_email,paypal_transaction_id,payout_uuid,status,version'+(admin?',processing_actor,user_reference':'');
 if(!exact(r,keys.split(',').sort().join(','))||!uuid(r.payout_uuid)||!pence(r.amount_pence)||r.currency!=='GBP'||!email(r.paypal_email)||!['requested','processing','sent','rejected','cancelled'].includes(r.status)||!Number.isSafeInteger(r.version)||r.version<1||r.version>4294967295||!utc(r.created_at)||!utc(r.due_at)||Date.parse(r.due_at)-Date.parse(r.created_at)!==86400000||r.automatically_sent!==false||(r.status==='sent'?!/^[A-Z0-9]{17}$/.test(r.paypal_transaction_id||''):r.paypal_transaction_id!==null)||admin&&(!ref(r.user_reference)||r.processing_actor!==null&&!ref(r.processing_actor)))fail();return {...r};
}
export function projectPaypalPayoutResponse(r,command,admin=false){
 if(command.action==='list'){
  if(!exact(r,'automatic_payments,has_more,items,limit,minimum_pence,offset,target_hours')||!Array.isArray(r.items)||r.items.length>command.limit||r.limit!==command.limit||r.offset!==command.offset||typeof r.has_more!=='boolean'||r.has_more&&r.items.length!==r.limit||r.minimum_pence!=='5000'||r.target_hours!==24||r.automatic_payments!==false)fail();const items=r.items.map(x=>projectPaypalPayout(x,admin));if(new Set(items.map(x=>x.payout_uuid)).size!==items.length)fail();return {...r,items};
 }
 if(!exact(r,'duplicate,request')||typeof r.duplicate!=='boolean')fail();const v=projectPaypalPayout(r.request,admin);
 if(command.action==='submit'?(v.amount_pence!==command.amount_pence||v.paypal_email!==command.paypal_email):(v.payout_uuid!==command.payout_uuid||v.version!==command.expected_version+1||v.status!==({claim:'processing',cancel:'cancelled',reject:'rejected',sent:'sent'})[command.action]||admin&&v.user_reference!==command.user_reference||command.action==='sent'&&(v.amount_pence!==command.amount_pence||v.paypal_email!==command.paypal_email||v.paypal_transaction_id!==command.paypal_transaction_id)))fail();return {duplicate:r.duplicate,request:v};
}
