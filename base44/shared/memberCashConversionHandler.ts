import {validCashConversionBody,projectCashConversionPolicy,projectCashConversionReceipt} from './cashConversionContract.ts';
const FLAGS=['PERKSPHERE_CASH_MEMBER_ENABLED','PERKSPHERE_CASH_SOURCE_ENABLED','PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE'];
const active=u=>typeof u?.id==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(u.id)&&!['disabled','suspended','banned'].includes(u.account_status);
export function createMemberCashConversionHandler({getClient,getSecret,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});let dispatched=false;
  try{
   const client=getClient(req),user=await client.auth.me().catch(()=>null);if(!user?.id)return reply(401,{error:'unauthorized'});if(!active(user))return reply(403,{error:'forbidden'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048)return reply(400,{error:'invalid_request'});text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
   let b;try{b=JSON.parse(text);}catch{return reply(400,{error:'invalid_request'});}if(!validCashConversionBody(b))return reply(400,{error:'invalid_request'});
   const enabled=()=>FLAGS.every(k=>getSecret(k)==='true');if(!enabled())return b.action==='policy'?reply(200,{data:projectCashConversionPolicy({available:false,configured:false,currency:'GBP',policy:null,payouts_enabled:false})}):reply(503,{error:'cash_conversion_paused'});
   const current=async()=>{const u=await client.auth.me().catch(()=>null);if(!active(u)||u.id!==user.id||!enabled())throw Error('UNAVAILABLE');};await current();
   const {action,...payload}=b;dispatched=action==='convert';const result=await post('/v1/perk-sphere/cash/'+action,{...payload,actor:{role:'member',user_reference:user.id}});await current();
   if(!result?.ok){if(dispatched&&result?.status===409&&result.code==='CASH_POLICY_CHANGED')return reply(409,{error:'cash_policy_changed',retry_with_new_policy:true});throw Error('UNAVAILABLE');}
   if(action==='policy'){const r=result.data;if(typeof r?.configured!=='boolean'||r.payouts_enabled===true)throw Error('UNAVAILABLE');return reply(200,{data:projectCashConversionPolicy({available:true,configured:r.configured,currency:'GBP',policy:r.configured?r:null,payouts_enabled:false})});}
   return reply(200,{data:projectCashConversionReceipt(result.data,{actorId:user.id,body:b})});
  }catch{return reply(dispatched?409:503,{error:dispatched?'cash_conversion_unconfirmed':'cash_conversion_unavailable'});}
 };
}
