const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===keys;
const minor=v=>typeof v==='string'&&/^[1-9][0-9]{0,12}$/.test(v)&&BigInt(v)<=1000000000000n;
export function giftMemberCheckoutRequest(body){
 if(body?.action==='confirmation'){
  const {action,...input}=body,read=input.operation==='read';
  if(!exact(input,read?'fields,offerReference,operation':'approved,country,expectedVersion,fields,offerReference,operation,region,requestReference')||!['read','revise'].includes(input.operation))throw Error('INVALID_REQUEST');
  const canonical=giftMemberCheckoutRequest({action:'quote',offerReference:input.offerReference,fields:input.fields,requestReference:read?'00000000-0000-4000-8000-000000000000':input.requestReference});
  if(read)return Object.freeze({action,operation:'read',offerReference:canonical.offerReference,fields:canonical.fields});
  if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>=4294967295||typeof input.approved!=='boolean'||typeof input.country!=='string'||!/^[A-Z]{2}$/.test(input.country)||input.region!==null&&(typeof input.region!=='string'||!/^[A-Za-z0-9_:@. -]{1,64}$/.test(input.region)))throw Error('INVALID_REQUEST');
  return Object.freeze({...input,action,fields:canonical.fields});
 }
 if(body?.action==='prepare'&&exact(body,'action,quoteDigest')&&digest(body.quoteDigest))return Object.freeze({action:'prepare',quoteDigest:body.quoteDigest});
 if(!exact(body,'action,fields,offerReference,requestReference')||body.action!=='quote'||typeof body.offerReference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(body.offerReference)||!uuid(body.requestReference)||!Array.isArray(body.fields)||body.fields.length>20)throw Error('INVALID_REQUEST');
 const fields=body.fields.map(f=>{if(!exact(f,'key,value')||typeof f.key!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(f.key)||typeof f.value!=='string'||!f.value.trim()||f.value.length>1000||/[\x00-\x1f\x7f]/.test(f.value))throw Error('INVALID_REQUEST');return Object.freeze({key:f.key,value:f.value});}).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 if(new Set(fields.map(f=>f.key)).size!==fields.length||new TextEncoder().encode(JSON.stringify({offerId:body.offerReference,fields})).byteLength>8192)throw Error('INVALID_REQUEST');
 return Object.freeze({action:'quote',offerReference:body.offerReference,requestReference:body.requestReference,fields:Object.freeze(fields)});
}
export function projectGiftMemberCheckoutResult(raw,command){
 if(!exact(raw,'data,ok,productionReady')||raw.ok!==true||raw.productionReady!==false)throw Error('INVALID_CHECKOUT_REPORT');
 const r=raw.data;
 if(command.action==='confirmation'){
  const read=command.operation==='read';
  if(!exact(r,read?'approved,country,found,independentlyVerified,region,source,version':'approved,duplicate,independentlyVerified,source,version')||r.source!=='member_confirmation'||r.independentlyVerified!==false||typeof r.approved!=='boolean'||!Number.isSafeInteger(r.version)||r.version<0||r.version>4294967295)throw Error('INVALID_CHECKOUT_REPORT');
  if(read){
   if(typeof r.found!=='boolean'||(r.found?(r.version<1||typeof r.country!=='string'||!/^[A-Z]{2}$/.test(r.country)||r.region!==null&&(typeof r.region!=='string'||!/^[A-Za-z0-9_:@. -]{1,64}$/.test(r.region))):(r.version!==0||r.approved!==false||r.country!==null||r.region!==null)))throw Error('INVALID_CHECKOUT_REPORT');
  }else if(r.version!==command.expectedVersion+1||r.approved!==command.approved||typeof r.duplicate!=='boolean')throw Error('INVALID_CHECKOUT_REPORT');
  return {...r};
 }
 if(command.action==='quote'){
  if(!exact(r,'amountMinor,checkoutEnabled,currency,dispatchAllowed,duplicate,expiresAt,faceCurrency,faceValueMinor,quoteDigest,quoteUuid')||!uuid(r.quoteUuid)||!digest(r.quoteDigest)||typeof r.duplicate!=='boolean'||!['GBP','USD'].includes(r.currency)||!['GBP','USD'].includes(r.faceCurrency)||!minor(r.amountMinor)||!minor(r.faceValueMinor)||typeof r.expiresAt!=='string'||!Number.isFinite(Date.parse(r.expiresAt))||new Date(r.expiresAt).toISOString()!==r.expiresAt||r.checkoutEnabled!==false||r.dispatchAllowed!==false)throw Error('INVALID_CHECKOUT_REPORT');
  return {quoteUuid:r.quoteUuid,quoteDigest:r.quoteDigest,duplicate:r.duplicate,currency:r.currency,amountMinor:r.amountMinor,faceCurrency:r.faceCurrency,faceValueMinor:r.faceValueMinor,expiresAt:r.expiresAt,checkoutEnabled:false,dispatchAllowed:false};
 }
 if(!exact(r,'captureMade,checkoutEnabled,checkoutUuid,dispatchAllowed,duplicate,paymentVerified,quoteDigest,state,version')||!uuid(r.checkoutUuid)||r.quoteDigest!==command.quoteDigest||!((r.state==='prepared'&&r.version===1)||(r.state==='create_started'&&r.version===2))||typeof r.duplicate!=='boolean'||['captureMade','checkoutEnabled','dispatchAllowed','paymentVerified'].some(k=>r[k]!==false))throw Error('INVALID_CHECKOUT_REPORT');
 return {checkoutUuid:r.checkoutUuid,quoteDigest:r.quoteDigest,state:r.state,version:r.version,duplicate:r.duplicate,checkoutEnabled:false,paymentVerified:false,captureMade:false,dispatchAllowed:false};
}
