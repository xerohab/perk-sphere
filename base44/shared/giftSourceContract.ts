export const GIFT_SOURCE_EVENTS=['CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.RESOLVED','CUSTOMER.DISPUTE.UPDATED','PAYMENT.CAPTURE.REFUNDED'];
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===keys;
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(v);
export function giftSourceScope(v){
 if(!v||!['sandbox','live'].includes(v.mode)||typeof v.merchantReference!=='string'||!/^[A-Z0-9]{1,100}$/.test(v.merchantReference)||typeof v.webhookReference!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(v.webhookReference))throw Error('INVALID_SOURCE');
 return {mode:v.mode,merchantReference:v.merchantReference,webhookReference:v.webhookReference};
}
export function giftSource(v){
 if(!exact(v,'credentialVersion,eventTypes,intakeActorReference,merchantReference,mode,state,webhookReference,workerActorReference')||!['paused','active'].includes(v.state)||typeof v.credentialVersion!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(v.credentialVersion)||!ref(v.intakeActorReference)||!ref(v.workerActorReference)||!Array.isArray(v.eventTypes)||!v.eventTypes.length||v.eventTypes.length>4||new Set(v.eventTypes).size!==v.eventTypes.length||v.eventTypes.some(e=>!GIFT_SOURCE_EVENTS.includes(e)))throw Error('INVALID_SOURCE');
 return Object.freeze({...giftSourceScope(v),credentialVersion:v.credentialVersion,intakeActorReference:v.intakeActorReference,workerActorReference:v.workerActorReference,state:v.state,eventTypes:Object.freeze([...v.eventTypes].sort())});
}
export function giftSourceCommand(v){
 if(v?.action==='read'&&exact(v,'action,source')&&exact(v.source,'merchantReference,mode,webhookReference'))return Object.freeze({action:'read',source:Object.freeze(giftSourceScope(v.source))});
 if(v?.action==='revise'&&exact(v,'action,expectedVersion,source')&&Number.isSafeInteger(v.expectedVersion)&&v.expectedVersion>=0&&v.expectedVersion<100)return Object.freeze({action:'revise',expectedVersion:v.expectedVersion,source:giftSource(v.source)});
 throw Error('INVALID_REQUEST');
}
export function projectGiftSourceResult(result,command){
 if(result?.production_ready!==false||result?.data?.financial_clearance_verified!==false)throw Error('INVALID_REPORT');
 const d=result.data;
 if(command.action==='revise'){
  if(d.version!==command.expectedVersion+1||typeof d.replayed!=='boolean')throw Error('INVALID_REPORT');
  return {version:d.version,replayed:d.replayed,financial_clearance_verified:false};
 }
 if(!Number.isSafeInteger(d.version)||d.version<0||d.version>100||d.version===0&&d.source!==null||d.version>0&&!d.source)throw Error('INVALID_REPORT');
 const source=d.source===null?null:giftSource(d.source);
 if(source&&JSON.stringify(giftSourceScope(source))!==JSON.stringify(giftSourceScope(command.source)))throw Error('SOURCE_SCOPE_MISMATCH');
 return {version:d.version,source,financial_clearance_verified:false};
}
