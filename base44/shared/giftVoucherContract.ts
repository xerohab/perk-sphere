const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function giftVoucherRequest(body){
 if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).sort().join(',')!=='intentUuid,requestReference'||!uuid(body.intentUuid)||!uuid(body.requestReference))throw Error('INVALID_REQUEST');
 return Object.freeze({intentUuid:body.intentUuid,requestReference:body.requestReference});
}
export function projectGiftVoucherResult(raw,request){
 const r=raw?.data??raw,v=r?.voucher;
 if(!r||Object.keys(r).sort().join(',')!=='duplicate,intent_uuid,provider_delivery_verified,voucher'||r.intent_uuid!==request.intentUuid||typeof r.duplicate!=='boolean'||r.provider_delivery_verified!==false||!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join(',')!=='code,currency,expiresAt,faceValueMinor,instructions,redemptionUrl,voucherId')throw Error('INVALID_RECEIPT');
 if(typeof v.voucherId!=='string'||!v.voucherId.trim()||v.voucherId.length>191||typeof v.code!=='string'||!v.code.trim()||v.code.length>2048||/[\x00-\x1f\x7f]/.test(v.voucherId+v.code)||!['GBP','USD'].includes(v.currency)||typeof v.faceValueMinor!=='string'||!/^[1-9][0-9]{0,12}$/.test(v.faceValueMinor)||BigInt(v.faceValueMinor)>1000000000000n||typeof v.instructions!=='string'||v.instructions.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v.instructions))throw Error('INVALID_RECEIPT');
 if(v.expiresAt!==null&&(typeof v.expiresAt!=='string'||new Date(v.expiresAt).toISOString()!==v.expiresAt))throw Error('INVALID_RECEIPT');
 let redemptionUrl=null;
 if(v.redemptionUrl!==null){if(typeof v.redemptionUrl!=='string'||v.redemptionUrl.length>2048)throw Error('INVALID_RECEIPT');const u=new URL(v.redemptionUrl);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('INVALID_RECEIPT');redemptionUrl=u.href;}
 if(new TextEncoder().encode(JSON.stringify(v)).byteLength>8192)throw Error('INVALID_RECEIPT');
 return {intent_uuid:r.intent_uuid,duplicate:r.duplicate,provider_delivery_verified:false,voucher:{voucherId:v.voucherId,code:v.code,currency:v.currency,faceValueMinor:v.faceValueMinor,instructions:v.instructions,expiresAt:v.expiresAt,redemptionUrl}};
}
