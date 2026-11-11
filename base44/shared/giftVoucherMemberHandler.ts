import {giftVoucherRequest,projectGiftVoucherResult} from './giftVoucherContract.ts';
export function createGiftVoucherMemberHandler({getClient,getSecret,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','Expires':'0','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const client=getClient(req),member=async()=>{const u=await client.auth.me().catch(()=>null);return u&&typeof u.id==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(u.id)&&!['disabled','suspended','banned'].includes(u.account_status)?u:null;};
   const initial=await member();if(!initial)return reply(401,{error:'authentication_required'});
   const actor=initial.id,enabled=()=>getSecret('PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED')==='true';
   if(!enabled())return reply(503,{error:'voucher_unavailable'});
   if(!/^Bearer [^\s]+$/i.test(req.headers.get('authorization')||''))return reply(403,{error:'request_denied'});
   if(new URL(req.url).search)return reply(400,{error:'invalid_request'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});
   let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return reply(413,{error:'request_too_large'});text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}catch{return reply(400,{error:'invalid_request'});}finally{await reader.cancel().catch(()=>{});}
   let command;try{command=giftVoucherRequest(JSON.parse(text));}catch{return reply(400,{error:'invalid_request'});}
   const current=async()=>enabled()&&(await member())?.id===actor&&enabled();
   if(!await current())return reply(403,{error:'request_denied'});
   const result=await post('/v1/perk-sphere/gift-vouchers/reveal',{...command,actor:{role:'member',user_reference:actor}});
   if(!result?.ok||!await current())throw Error();
   const data=projectGiftVoucherResult(result.data,command);
   if(!await current())throw Error();
   return reply(200,{data});
  }catch{return reply(503,{error:'voucher_unavailable'});}
 };
}
