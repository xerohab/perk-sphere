import {validCashConversionBody,quoteCashConversion,projectCashConversionReceipt} from '../../base44/shared/cashConversionContract.ts';
import {requestCashConversion} from './cash-conversion-client.js';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
const member=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(v);
export function cashRecoveryKey(actorId){if(!member(actorId))throw Error('CASH_RECOVERY_INVALID');return 'perksphere-cash-conversion:'+actorId;}
export function parseCashRecovery(raw,actorId){
 if(raw===null)return null;
 try{
  if(typeof raw!=='string'||raw.length>4096)throw Error();const r=JSON.parse(raw);
  if(!member(actorId)||!exact(r,'credited_pence,member_reference,policy,receipt,request,status,version')||r.version!==1||r.member_reference!==actorId||!['pending','confirmed'].includes(r.status)||!validCashConversionBody(r.request)||r.request.action!=='convert'||!exact(r.policy,'enabled,input_points,output_pence,version')||r.request.policy_version!==r.policy.version||quoteCashConversion(r.request.points,r.policy)!==r.credited_pence)throw Error();
  if(r.status==='pending'){if(r.receipt!==null)throw Error();}
  else {const receipt=projectCashConversionReceipt({...r.receipt,user_reference:actorId},{actorId,body:r.request});if(receipt.credited_pence!==r.credited_pence||JSON.stringify(receipt)!==JSON.stringify(r.receipt))throw Error();}
  return r;
 }catch{throw Error('CASH_RECOVERY_INVALID');}
}
export function pendingCashRecovery({actorId,points,policy,requestReference}){
 const r={version:1,member_reference:actorId,status:'pending',request:{action:'convert',request_reference:requestReference,points,policy_version:policy?.version},policy:{enabled:policy?.enabled,version:policy?.version,input_points:policy?.input_points,output_pence:policy?.output_pence},credited_pence:quoteCashConversion(points,policy),receipt:null};
 return parseCashRecovery(JSON.stringify(r),actorId);
}
export function readCashRecovery(storage,actorId){try{return parseCashRecovery(storage.getItem(cashRecoveryKey(actorId)),actorId);}catch(error){throw Error(error.message==='CASH_RECOVERY_INVALID'?'CASH_RECOVERY_INVALID':'CASH_RECOVERY_UNAVAILABLE');}}
export function saveCashRecovery(storage,actorId,record){
 const raw=JSON.stringify(parseCashRecovery(JSON.stringify(record),actorId));
 try{storage.setItem(cashRecoveryKey(actorId),raw);if(storage.getItem(cashRecoveryKey(actorId))!==raw)throw Error();}catch{throw Error('CASH_RECOVERY_UNAVAILABLE');}return record;
}
function removeExact(storage,actorId,record){const raw=JSON.stringify(record);if(JSON.stringify(readCashRecovery(storage,actorId))!==raw)throw Error('CASH_RECOVERY_CHANGED');try{storage.removeItem(cashRecoveryKey(actorId));if(storage.getItem(cashRecoveryKey(actorId))!==null)throw Error();}catch{throw Error('CASH_RECOVERY_UNAVAILABLE');}}
export function clearConfirmedCashRecovery(storage,actorId){const r=readCashRecovery(storage,actorId);if(!r||r.status!=='confirmed')throw Error('CASH_RECOVERY_NOT_CONFIRMED');removeExact(storage,actorId,r);}
export async function submitCashRecovery({base44,storage,actorId,isCurrent=()=>true,request=requestCashConversion}){
 if(!isCurrent())throw Error('CASH_CONTEXT_CHANGED');const record=readCashRecovery(storage,actorId);if(!record)throw Error('CASH_RECOVERY_MISSING');
 if(record.status==='confirmed')return {state:'confirmed',receipt:record.receipt,recovery_cleared:false};
 let receipt;
 try{receipt=await request({base44,actorId,body:record.request,isCurrent});}
 catch(error){if(error.message==='CASH_POLICY_CHANGED_NO_CREDIT'&&isCurrent()){removeExact(storage,actorId,record);return {state:'policy_changed',recovery_cleared:true};}throw error;}
 return finalizeCashRecovery({storage,actorId,record,receipt,isCurrent});
}

function finalizeCashRecovery({storage,actorId,record,receipt,isCurrent}){
 if(!isCurrent())throw Error('CASH_CONTEXT_CHANGED');
 receipt=projectCashConversionReceipt({...receipt,user_reference:actorId},{actorId,body:record.request});
 if(receipt.credited_pence!==record.credited_pence)throw Error('CASH_CONVERSION_UNCONFIRMED');
 if(JSON.stringify(readCashRecovery(storage,actorId))!==JSON.stringify(record))throw Error('CASH_RECOVERY_CHANGED');
 const confirmed={...record,status:'confirmed',receipt};saveCashRecovery(storage,actorId,confirmed);
 let cleared=false;try{clearConfirmedCashRecovery(storage,actorId);cleared=true;}catch{}
 return {state:'confirmed',receipt,recovery_cleared:cleared};
}

export async function checkCashRecoveryReceipt({base44,storage,actorId,isCurrent=()=>true,request=requestCashConversion}){if(!isCurrent())throw Error('CASH_CONTEXT_CHANGED');const record=readCashRecovery(storage,actorId);if(!record)throw Error('CASH_RECOVERY_MISSING');if(record.status==='confirmed')return {state:'confirmed',receipt:record.receipt,recovery_cleared:false};const result=await request({base44,actorId,body:{action:'receipt',points:record.request.points,policy_version:record.request.policy_version,request_reference:record.request.request_reference},isCurrent});if(!isCurrent())throw Error('CASH_CONTEXT_CHANGED');if(result?.read_only!==true||typeof result.found!=='boolean'||result.request_reference!==record.request.request_reference||result.policy_version!==record.request.policy_version||result.points_spent!==String(record.request.points)||result.currency!=='GBP'||result.payout_sent!==false)throw Error('CASH_CONVERSION_UNCONFIRMED');if(!result.found)return {state:'pending',recovery_cleared:false};return finalizeCashRecovery({storage,actorId,record,receipt:result,isCurrent});}
