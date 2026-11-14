import {giftMemberCheckoutRequest,projectGiftMemberCheckoutResult} from './giftMemberCheckoutContract.ts';
export function createGiftMemberCheckoutHandler({getClient,getSecret,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','Expires':'0','Vary':'Authorization, Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const client=getClient(req),member=async()=>{const u=await client.auth.me().catch(()=>null);return u&&typeof u.id==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(u.id)&&['user','admin'].includes(u.role)&&!['disabled','suspended','banned'].includes(u.account_status)?u:null;};
   const initial=await member();if(!initial)return reply(401,{error:'authentication_required'});
   const actor=initial.id,enabled=()=>getSecret('PERKSPHERE_GIFT_CHECKOUT_MEMBER_ENABLED')==='true';if(!enabled())return reply(503,{error:'checkout_unavailable'});
   if(!/^Bearer [^\s]+$/i.test(req.headers.get('authorization')||''))return reply(403,{error:'request_denied'});
   if(new URL(req.url).search)return reply(400,{error:'invalid_request'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12288)return reply(413,{error:'request_too_large'});raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{return reply(400,{error:'invalid_request'});}finally{await reader.cancel().catch(()=>{});}
   let command;try{command=giftMemberCheckoutRequest(JSON.parse(raw));}catch{return reply(400,{error:'invalid_request'});}
   const current=async()=>enabled()&&(await member())?.id===actor&&enabled();if(!await current())return reply(403,{error:'request_denied'});
   const {action,...body}=command,path=action==='quote'?'/v1/perk-sphere/gifts/quotes':'/v1/perk-sphere/gifts/checkouts/prepare';
   const result=await post(path,{...body,actor:{role:'member',user_reference:actor}});if(!result?.ok||!await current())throw Error();
   const data=projectGiftMemberCheckoutResult(result.data,command);if(!await current())throw Error();return reply(200,{data});
  }catch{return reply(503,{error:'checkout_unavailable'});}
 };
}
