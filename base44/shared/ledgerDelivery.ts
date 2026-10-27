import { secrets } from 'base44:runtime';
import {projectPartnerTaskAward} from './partnerTaskProjection.ts';
export function ledgerDeliveryCapabilities(){return {revision:'ledger-delivery-v2',task_projection_supported:true,wallet_authoritative:secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true'};}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields=['delivery_uuid','event_type','operation_type','operation_uuid','points_delta','user_reference','xp_delta'];
function deliveryFields(body){return body?.task_reference===undefined?fields:[...fields,'task_reference'].sort();}
function valid(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==deliveryFields(body).join(',')||body.event_type!=='LEDGER_APPLIED')return false;
 if(!uuid.test(body.delivery_uuid||'')||!uuid.test(body.operation_uuid||'')||typeof body.user_reference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(body.user_reference))return false;
 if(!['opening_balance','task_reward','partner_reward','manual_adjustment','redemption','reversal','xp_conversion'].includes(body.operation_type))return false;
 for(const key of ['points_delta','xp_delta']){if(typeof body[key]!=='string'||!/^(-?[1-9][0-9]*|0)$/.test(body[key]))return false;const n=BigInt(body[key]);if(n<-(1n<<63n)||n>(1n<<63n)-1n)return false;}
 if(body.task_reference!==undefined&&(!/^[a-f0-9]{24}$/.test(body.task_reference)||body.operation_type!=='partner_reward'||BigInt(body.points_delta)<0n||BigInt(body.xp_delta)<0n||BigInt(body.points_delta)>1000000n||BigInt(body.xp_delta)>1000000n))return false;
 return true;
}
// Called only after the parent endpoint verifies Linux HMAC and nonce.
// This is an immutable receipt, never another balance writer or award command.
export async function receiveLedgerDelivery(admin,body){
 const headers={'Cache-Control':'no-store'};
 if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true')return Response.json({ok:false,error:'ledger_not_authoritative'},{status:503,headers});
 if(!valid(body))return Response.json({ok:false,error:'invalid_ledger_delivery'},{status:400,headers});
 try{
  const canonical=JSON.stringify(deliveryFields(body).map(key=>body[key]));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const existing=await admin.entities.LedgerDeliveryReceipt.filter({delivery_uuid:body.delivery_uuid});
  if(existing.some(row=>row.payload_hash!==hash))return Response.json({ok:false,error:'ledger_delivery_conflict'},{status:409,headers});
  if(!existing.length){
   const user=await admin.entities.User.get(body.user_reference);
   if(user?.id!==body.user_reference)return Response.json({ok:false,error:'member_not_found'},{status:409,headers});
   await admin.entities.LedgerDeliveryReceipt.create({user_id:body.user_reference,delivery_uuid:body.delivery_uuid,operation_uuid:body.operation_uuid,operation_type:body.operation_type,points_delta:body.points_delta,xp_delta:body.xp_delta,payload_hash:hash,...(body.task_reference?{task_reference:body.task_reference}:{} )});
  }
  if(body.task_reference)await projectPartnerTaskAward(admin,body);
  return Response.json({ok:true,data:{accepted:true,delivery_uuid:body.delivery_uuid,operation_uuid:body.operation_uuid,user_reference:body.user_reference}},{headers});
 }catch{return Response.json({ok:false,error:'ledger_delivery_unavailable'},{status:503,headers});}
}
