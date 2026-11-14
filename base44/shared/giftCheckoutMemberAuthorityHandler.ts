export function createGiftCheckoutMemberAuthorityHandler({getClient,getSecret,verify,clock=Date.now}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
  try{
   const enabled=()=>getSecret('PERKSPHERE_GIFT_CHECKOUT_MEMBER_ENABLED')==='true';if(!enabled())return reply(503,{ok:false,error:'checkout_authority_unavailable'});
   if(new URL(req.url).search)return reply(400,{ok:false,error:'invalid_request'});
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{ok:false,error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{ok:false,error:'invalid_request'});let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return reply(413,{ok:false,error:'request_too_large'});raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{return reply(400,{ok:false,error:'invalid_request'});}finally{await reader.cancel().catch(()=>{});}
   const admin=getClient(req).asServiceRole,proof=await verify(new Request(req.url,{method:'POST',headers:req.headers,body:raw}),admin,'/functions/trustedGiftCheckoutMemberAuthority');
   if(!proof.ok)return reply(proof.status===401?401:503,{ok:false,error:'trusted_authentication_required'});
   const b=JSON.parse(proof.rawBody),now=clock();
   if(!b||Object.keys(b).sort().join(',')!=='expiresAt,permission,requestNonce,scope,userReference'||typeof b.userReference!=='string'||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(b.userReference)||!['gift_quote:request','gift_checkout:prepare'].includes(b.permission)||typeof b.requestNonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(b.requestNonce)||typeof b.expiresAt!=='string'||!b.scope||Object.keys(b.scope).sort().join(',')!=='action,commandDigest'||b.scope.action!==(b.permission==='gift_quote:request'?'quote':'prepare')||typeof b.scope.commandDigest!=='string'||!/^[a-f0-9]{64}$/.test(b.scope.commandDigest))return reply(400,{ok:false,error:'invalid_request'});
   const deadline=Date.parse(b.expiresAt);if(!Number.isSafeInteger(now)||!Number.isFinite(deadline)||new Date(deadline).toISOString()!==b.expiresAt||deadline<=now||deadline>now+30000)return reply(403,{ok:false,error:'authorization_expired'});
   const user=await admin.entities.User.get(b.userReference).catch(()=>null),current=clock();
   const authorized=user?.id===b.userReference&&['user','admin'].includes(user.role)&&!['disabled','banned','suspended'].includes(user.account_status)&&enabled()&&Number.isSafeInteger(current)&&current>=now&&current<deadline;
   return reply(200,{ok:true,data:{authorized:!!authorized,userReference:b.userReference,permission:b.permission,scope:b.scope,requestNonce:b.requestNonce,expiresAt:b.expiresAt}});
  }catch{return reply(503,{ok:false,error:'checkout_authority_unavailable'});}
 };
}
