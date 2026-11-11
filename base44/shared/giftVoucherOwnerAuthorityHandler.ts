import {giftVoucherRequest} from './giftVoucherContract.ts';
export function createGiftVoucherOwnerAuthorityHandler({getClient,getSecret,verify,clock=Date.now}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
  try{
   if(getSecret('PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED')!=='true')return reply(503,{ok:false,error:'voucher_authority_unavailable'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{ok:false,error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{ok:false,error:'invalid_request'});
   let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return reply(413,{ok:false,error:'request_too_large'});raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{return reply(400,{ok:false,error:'invalid_request'});}finally{await reader.cancel().catch(()=>{});}
   const admin=getClient(req).asServiceRole,proof=await verify(new Request(req.url,{method:'POST',headers:req.headers,body:raw}),admin,'/functions/trustedGiftVoucherOwnerAuthority');
   if(!proof.ok)return reply(proof.status===401?401:503,{ok:false,error:'trusted_authentication_required'});
   const b=JSON.parse(proof.rawBody);
   if(!b||Object.keys(b).sort().join(',')!=='expiresAt,permission,requestNonce,scope,userReference'||b.permission!=='gift_voucher:read'||typeof b.userReference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(b.userReference)||typeof b.requestNonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(b.requestNonce)||typeof b.expiresAt!=='string')return reply(400,{ok:false,error:'invalid_request'});
   const scope=giftVoucherRequest(b.scope),deadline=Date.parse(b.expiresAt),now=clock();
   if(!Number.isFinite(deadline)||deadline<=now||deadline>now+30000)return reply(403,{ok:false,error:'authorization_expired'});
   const user=await admin.entities.User.get(b.userReference).catch(()=>null);
   const authorized=user?.id===b.userReference&&['user','admin'].includes(user.role)&&!['disabled','banned','suspended'].includes(user.account_status)&&getSecret('PERKSPHERE_GIFT_VOUCHER_MEMBER_ENABLED')==='true'&&clock()<deadline;
   return reply(200,{ok:true,data:{authorized:!!authorized,userReference:b.userReference,permission:b.permission,scope,requestNonce:b.requestNonce,expiresAt:b.expiresAt}});
  }catch{return reply(503,{ok:false,error:'voucher_authority_unavailable'});}
 };
}
