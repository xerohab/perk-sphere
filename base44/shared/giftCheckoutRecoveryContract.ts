const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function giftCheckoutRecoveryScope(body){
 if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).sort().join(',')!=='checkoutUuid,userReference'||!ref(body.userReference)||!uuid(body.checkoutUuid))throw Error('INVALID_SCOPE');
 return Object.freeze({userReference:body.userReference,checkoutUuid:body.checkoutUuid});
}
export function projectGiftCheckoutRecovery(raw,scope){
 const r=raw?.data??raw,fields=['checkoutUuid','paypalRequestId','state','version','mode','quoteExpired','orderReceiptPresent','paypalOrderReference','recoveryAction','providerCalls','creationAllowed','replacementOrderAllowed','paymentVerified','captureMade','dispatchAllowed','productionReady'];
 if(!r||Object.keys(r).sort().join(',')!==[...fields].sort().join(',')||r.checkoutUuid!==scope.checkoutUuid||!uuid(r.paypalRequestId)||!['sandbox','live'].includes(r.mode)||typeof r.quoteExpired!=='boolean'||typeof r.orderReceiptPresent!=='boolean'||r.providerCalls!==0||['creationAllowed','replacementOrderAllowed','paymentVerified','captureMade','dispatchAllowed','productionReady'].some(k=>r[k]!==false))throw Error('INVALID_REPORT');
 if(!((r.state==='prepared'&&r.version===1)||(r.state==='create_started'&&r.version===2)))throw Error('INVALID_REPORT');
 if(r.orderReceiptPresent?(r.state!=='create_started'||typeof r.paypalOrderReference!=='string'||!/^[A-Z0-9]{1,36}$/.test(r.paypalOrderReference)):r.paypalOrderReference!==null)throw Error('INVALID_REPORT');
 const action=r.state==='prepared'?(r.quoteExpired?'request_new_quote':'review_original_prepared_checkout'):(r.orderReceiptPresent?'reconcile_original_order':'obtain_original_creation_evidence');
 if(r.recoveryAction!==action)throw Error('INVALID_REPORT');
 return Object.fromEntries(fields.map(k=>[k,r[k]]));
}
