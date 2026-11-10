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
 if(['read','operations'].includes(v?.action)&&exact(v,'action,source')&&exact(v.source,'merchantReference,mode,webhookReference'))return Object.freeze({action:v.action,source:Object.freeze(giftSourceScope(v.source))});
 if(v?.action==='revise'&&exact(v,'action,expectedVersion,source')&&Number.isSafeInteger(v.expectedVersion)&&v.expectedVersion>=0&&v.expectedVersion<100)return Object.freeze({action:'revise',expectedVersion:v.expectedVersion,source:giftSource(v.source)});
 throw Error('INVALID_REQUEST');
}
export function projectGiftSourceResult(result,command){
 if(result?.production_ready!==false||result?.data?.financial_clearance_verified!==false)throw Error('INVALID_REPORT');
 const d=result.data;
 if(command.action==='operations')return projectGiftSourceOperations(d,command);
 if(command.action==='revise'){
  if(d.version!==command.expectedVersion+1||typeof d.replayed!=='boolean')throw Error('INVALID_REPORT');
  return {version:d.version,replayed:d.replayed,financial_clearance_verified:false};
 }
 if(!Number.isSafeInteger(d.version)||d.version<0||d.version>100||d.version===0&&d.source!==null||d.version>0&&!d.source)throw Error('INVALID_REPORT');
 const source=d.source===null?null:giftSource(d.source);
 if(source&&JSON.stringify(giftSourceScope(source))!==JSON.stringify(giftSourceScope(command.source)))throw Error('SOURCE_SCOPE_MISMATCH');
 return {version:d.version,source,financial_clearance_verified:false};
}
const operationIssues=['notification_schema_unavailable','unknownStates','expiredLeases','overdueUnresolved','dead','capacity_review_required','merchant_mutex_unavailable','integrity_mismatches'];
const operationCounts=['total','pending','processing','retry','processed','dead','unknownStates','expiredLeases','overdueUnresolved','integrityMismatches'];
const integerCount=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function projectGiftSourceOperations(r,command){
 if(r?.readOnly!==true||r.workerRunningVerified!==false||r.providerCalls!==0||r.financial_clearance_verified!==false||r.production_ready!==false||typeof r.schemaAvailable!=='boolean'||typeof r.scopeIntegrityChecked!=='boolean'||typeof r.hasMoreCases!=='boolean'||!Array.isArray(r.issues)||r.issues.some(i=>!operationIssues.includes(i))||new Set(r.issues).size!==r.issues.length||!Array.isArray(r.cases)||r.cases.length>20)throw Error('INVALID_OPERATIONS_REPORT');
 const source=giftSourceScope(r.source);
 if(JSON.stringify(source)!==JSON.stringify(giftSourceScope(command.source)))throw Error('SOURCE_SCOPE_MISMATCH');
 const out={source,readOnly:true,schemaAvailable:r.schemaAvailable,scopeIntegrityChecked:r.scopeIntegrityChecked,counts:null,issues:[...r.issues],cases:[],hasMoreCases:r.hasMoreCases,workerRunningVerified:false,providerCalls:0,financial_clearance_verified:false,production_ready:false};
 if(!r.schemaAvailable){if(r.counts!==null||r.scopeIntegrityChecked||r.hasMoreCases||r.cases.length||r.issues.join(',')!=='notification_schema_unavailable')throw Error('INVALID_OPERATIONS_REPORT');return out;}
 if(r.issues.includes('notification_schema_unavailable'))throw Error('INVALID_OPERATIONS_REPORT');
 const counts={};for(const k of operationCounts){const value=r.counts?.[k];if(k==='integrityMismatches'&&value===null&&!r.scopeIntegrityChecked)counts[k]=null;else if(integerCount(value))counts[k]=value;else throw Error('INVALID_OPERATIONS_REPORT');}
 const total=BigInt(counts.total),unresolved=total-BigInt(counts.processed);
 if(['pending','processing','retry','processed','dead','unknownStates'].reduce((n,k)=>n+BigInt(counts[k]),0n)!==total||BigInt(counts.expiredLeases)>BigInt(counts.processing)||BigInt(counts.overdueUnresolved)>unresolved||r.scopeIntegrityChecked!==(total<=1000n)||counts.integrityMismatches!==null&&BigInt(counts.integrityMismatches)>total)throw Error('INVALID_OPERATIONS_REPORT');
 const expected=['unknownStates','expiredLeases','overdueUnresolved','dead'].filter(k=>BigInt(counts[k])>0n);
 if(total>1000n){if(counts.integrityMismatches!==null||r.cases.length||r.hasMoreCases)throw Error('INVALID_OPERATIONS_REPORT');expected.push('capacity_review_required');}
 else if(BigInt(counts.integrityMismatches)>0n)expected.push('integrity_mismatches');
 if(r.issues.includes('merchant_mutex_unavailable')){if(total===0n)throw Error('INVALID_OPERATIONS_REPORT');expected.push('merchant_mutex_unavailable');}
 if(JSON.stringify(expected.sort())!==JSON.stringify([...r.issues].sort()))throw Error('INVALID_OPERATIONS_REPORT');
 const seen=new Set(),caseCounts={pending:0n,processing:0n,retry:0n,dead:0n};
 const cases=r.cases.map(c=>{
  if(!c||typeof c.notificationHash!=='string'||!/^[a-f0-9]{64}$/.test(c.notificationHash)||seen.has(c.notificationHash)||!Object.hasOwn(caseCounts,c.state)||!Number.isSafeInteger(c.version)||c.version<1||c.version>11||!Number.isSafeInteger(c.attempts)||c.attempts<0||c.attempts>5||!timestamp(c.availableAt)||typeof c.leaseExpired!=='boolean'||(c.state==='processing'?!timestamp(c.leaseUntil):c.leaseUntil!==null))throw Error('INVALID_RECOVERY_CASE');
  if(c.state!=='processing'&&c.leaseExpired||c.state==='pending'&&c.attempts!==0||c.state==='dead'&&c.attempts!==5||['processing','retry'].includes(c.state)&&c.attempts<1||c.state==='retry'&&c.attempts>=5||c.state==='pending'&&c.version!==1)throw Error('INVALID_RECOVERY_CASE');
  const recoveryAction=c.state==='dead'?'operator_reconciliation':c.state==='processing'?(c.leaseExpired?'review_expired_lease':'await_current_lease'):'await_worker';
  if(c.recoveryAction!==recoveryAction)throw Error('INVALID_RECOVERY_CASE');
  seen.add(c.notificationHash);caseCounts[c.state]++;
  return {notificationHash:c.notificationHash,state:c.state,version:c.version,attempts:c.attempts,availableAt:c.availableAt,leaseUntil:c.leaseUntil,leaseExpired:c.leaseExpired,recoveryAction};
 });
 if(Object.entries(caseCounts).some(([k,v])=>v>BigInt(counts[k]))||BigInt(cases.length)>unresolved||r.hasMoreCases&&(cases.length!==20||unresolved<=20n))throw Error('INVALID_RECOVERY_CASES');
 return {...out,counts,cases};
}
