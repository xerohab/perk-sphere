import {validCashWalletRequest,projectMemberCashWallet} from './memberCashWalletContract.ts';
const FLAGS=['PERKSPHERE_CASH_WALLET_READ_ENABLED','PERKSPHERE_CASH_SOURCE_ENABLED','PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE'];
const active=u=>typeof u?.id==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(u.id)&&!['disabled','suspended','banned'].includes(u.account_status);
export function createMemberCashWalletHandler({getClient,getSecret,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const client=getClient(req),user=await client.auth.me().catch(()=>null);if(!user?.id)return reply(401,{error:'unauthorized'});if(!active(user))return reply(403,{error:'forbidden'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)return reply(400,{error:'invalid_request'});text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
   let body;try{body=JSON.parse(text);}catch{return reply(400,{error:'invalid_request'});}if(!validCashWalletRequest(body))return reply(400,{error:'invalid_request'});
   const enabled=()=>FLAGS.every(k=>getSecret(k)==='true');
   if(!enabled())return reply(200,{data:{enabled:false,read_only:true,currency:'GBP',payouts_enabled:false}});
   const current=async()=>{const u=await client.auth.me().catch(()=>null);if(!active(u)||u.id!==user.id||!enabled())throw Error('UNAVAILABLE');};
   await current();const result=await post('/v1/perk-sphere/cash/wallet',{...body,actor:{role:'member',user_reference:user.id}});await current();
   if(!result?.ok)throw Error('UNAVAILABLE');return reply(200,{data:projectMemberCashWallet(result.data,{actorId:user.id,body})});
  }catch{return reply(503,{error:'cash_wallet_unavailable'});}
 };
}
