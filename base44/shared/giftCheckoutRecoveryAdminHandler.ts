import {giftCheckoutRecoveryScope,projectGiftCheckoutRecovery} from './giftCheckoutRecoveryContract.ts';
export function createGiftCheckoutRecoveryAdminHandler({getClient,getSecret,authorize,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private, max-age=0','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  let dispatched=false;
  try{
   const client=getClient(req),initial=await authorize(client,'gift_checkout_recovery:read');
   if(initial.error)return reply(initial.error.status,{error:initial.error.status===401?'authentication_required':'request_denied'});
   const actor=initial.user?.id;
   if(typeof actor!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(actor))return reply(403,{error:'request_denied'});
   const enabled=()=>getSecret('PERKSPHERE_GIFT_CHECKOUT_RECOVERY_ADMIN_ENABLED')==='true';
   if(!enabled())return reply(503,{error:'gift_checkout_recovery_admin_paused'});
   // Browser requests must carry the SDK bearer header, not ambient cookies alone.
   if(!/^Bearer [^\s]+$/i.test(req.headers.get('authorization')||''))return reply(403,{error:'request_denied'});
   if(new URL(req.url).search)return reply(400,{error:'invalid_request'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});
   let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)return reply(413,{error:'request_too_large'});text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}catch{return reply(400,{error:'invalid_request'});}finally{await reader.cancel().catch(()=>{});}
   let command;try{command=giftCheckoutRecoveryScope(JSON.parse(text));}catch{return reply(400,{error:'invalid_request'});}
   const permission='gift_checkout_recovery:read';
   const check=async()=>{const latest=await authorize(client,permission);return !latest.error&&latest.user?.id===actor&&latest.user?.role==='admin'&&!['disabled','banned','suspended'].includes(latest.user?.account_status)&&enabled();};
   if(!await check())return reply(403,{error:'request_denied'});
   dispatched=false;
   const result=await post('/v1/perk-sphere/gift-checkouts/recovery',{...command,actor:{role:'admin',user_reference:actor}});
   if(!await check())throw Error('AUTHORITY_CHANGED');
   if(!result?.ok){if(result?.status===409&&result?.code==='source_revision_conflict')return reply(409,{error:'source_revision_conflict'});throw Error('UNAVAILABLE');}
   return reply(200,{data:projectGiftCheckoutRecovery(result.data,command),production_ready:false});
  }catch{return reply(dispatched?409:503,{error:dispatched?'source_update_unconfirmed':'gift_checkout_recovery_admin_unavailable',reconcile_required:dispatched});}
 };
}