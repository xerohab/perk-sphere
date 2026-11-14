import {validCashConversionBody,projectCashConversionPolicy,projectCashConversionReceipt,projectCashReceiptLookup} from '../../base44/shared/cashConversionContract.ts';
/** @overload
 * @param {{base44: any, actorId: string, body: {action: 'policy'}, isCurrent?: () => boolean}} options
 * @returns {Promise<ReturnType<typeof projectCashConversionPolicy>>}
 */
/** @overload
 * @param {{base44: any, actorId: string, body: {action: 'receipt', points: number, policy_version: number, request_reference: string}, isCurrent?: () => boolean}} options
 * @returns {Promise<ReturnType<typeof projectCashReceiptLookup>>}
 */
/** @overload
 * @param {{base44: any, actorId: string, body: {action: 'convert', points: number, policy_version: number, request_reference: string}, isCurrent?: () => boolean}} options
 * @returns {Promise<ReturnType<typeof projectCashConversionReceipt>>}
 */
/** @param {{base44: any, actorId: string, body: {action: string, points?: number, policy_version?: number, request_reference?: string}, isCurrent?: () => boolean}} options */
export async function requestCashConversion({base44,actorId,body,isCurrent=()=>true}){
 const current=async()=>{if(!isCurrent())throw Error('UNAVAILABLE');const u=await base44.auth.me();if(!isCurrent()||typeof actorId!=='string'||!actorId||u?.id!==actorId||['disabled','suspended','banned'].includes(u.account_status))throw Error('UNAVAILABLE');};
 try{if(!validCashConversionBody(body))throw Error('UNAVAILABLE');await current();let response;try{response=await base44.functions.invoke('convertMemberPoints',body);}catch(error){await current();if(body.action==='convert'&&error?.response?.status===409&&error.response.data?.error==='cash_policy_changed'&&error.response.data?.retry_with_new_policy===true)throw Error('CASH_POLICY_CHANGED_NO_CREDIT');throw Error('UNAVAILABLE');}await current();const r=response?.data?.data;return body.action==='policy'?projectCashConversionPolicy(r):body.action==='receipt'?projectCashReceiptLookup({...r,user_reference:actorId},{actorId,body}):projectCashConversionReceipt({...r,user_reference:actorId},{actorId,body});}
 catch(error){if(error.message==='CASH_POLICY_CHANGED_NO_CREDIT')throw error;throw Error(body?.action==='convert'?'CASH_CONVERSION_UNCONFIRMED':'CASH_POLICY_UNAVAILABLE');}
}
