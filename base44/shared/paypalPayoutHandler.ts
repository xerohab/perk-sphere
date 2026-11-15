import {paypalPayoutCommand,projectPaypalPayoutResponse} from './paypalPayoutContract.ts';
export function createPaypalPayoutHandler({getClient,getSecret,post,authorize},admin=false){
 return async req=>{
  const reply=(s,b)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','Vary':'Authorization, Cookie'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const client=getClient(req),active=u=>u?.id&&['user','admin'].includes(u.role)&&!['disabled','suspended','banned'].includes(u.account_status),identity=async()=>{if(admin){const a=await authorize(client,'payouts.manage');return a.error?null:a.user;}return client.auth.me().catch(()=>null);};
   const user=await identity();if(!active(user))return reply(403,{error:'request_denied'});
   const enabled=()=>['PERKSPHERE_PAYPAL_PAYOUT_REQUESTS_ENABLED','PERKSPHERE_CASH_SOURCE_ENABLED','PERKSPHERE_CASH_WALLET_READ_ENABLED','PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE'].every(k=>getSecret(k)==='true');
   if(!/^Bearer [^\s]+$/i.test(req.headers.get('authorization')||'')||new URL(req.url).search)return reply(403,{error:'request_denied'});
   if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||'')||req.headers.has('content-encoding'))return reply(415,{error:'unsupported_media_type'});
   const reader=req.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)return reply(413,{error:'request_too_large'});raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
   let command;try{command=paypalPayoutCommand(JSON.parse(raw),admin);}catch{return reply(400,{error:'invalid_request'});}
   if(!enabled())return command.action==='list'?reply(200,{data:{enabled:false}}):reply(503,{error:'payouts_paused'});
   const current=async()=>{const u=await identity();return enabled()&&active(u)&&u.id===user.id;};if(!await current())throw Error();
   const result=await post('/v1/perk-sphere/paypal-payouts/'+(admin?'admin':'member'),{...command,actor:{role:admin?'admin':'member',user_reference:user.id}});
   if(!await current())throw Error();if(!result?.ok)return reply(result?.status===409?409:503,{error:['PAYOUT_STATE_CONFLICT','PAYOUT_INSUFFICIENT_FUNDS'].includes(result?.code)?result.code:'payout_unconfirmed'});
   const data=projectPaypalPayoutResponse(result.data,command,admin);if(!await current())throw Error();return reply(200,{data:{enabled:true,...data}});
  }catch{return reply(503,{error:'payout_unconfirmed'});}
 };
}
