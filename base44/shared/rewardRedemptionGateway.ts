import {assertAccountEligible} from './rewardPolicy.ts';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
async function readInput(req){
 if(Number(req.headers.get('content-length'))>4096)throw Error('INVALID');
 const reader=req.body?.getReader();if(!reader)throw Error('INVALID');
 let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096)throw Error('INVALID');text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
 finally{await reader.cancel().catch(()=>{});}
}
export function createRewardRedemptionHandler({getClient,isAuthoritative,redeem,clock=Date.now}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const client=getClient(req),user=await client.auth.me().catch(()=>null);
   if(!id(user?.id))return reply(401,{error:'unauthorized'});
   if(['disabled','suspended','banned'].includes(user.account_status))return reply(403,{error:'redemption_restricted'});
   // The old Base44 writer must never service an authoritative Linux wallet.
   // No restriction, reward, user or wallet records are read on this path.
   if(isAuthoritative())return reply(503,{error:'reward_redemption_paused'});
   const body=await readInput(req).catch(()=>null);
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='rewardId'||!id(body.rewardId))return reply(400,{error:'invalid_request'});
   const admin=client.asServiceRole,restrictions=await admin.entities.Restriction.filter({user_id:user.id},'-created_date',101);
   if(!Array.isArray(restrictions)||restrictions.length>100)throw Error('UNAVAILABLE');
   const now=clock();if(!Number.isSafeInteger(now))throw Error('UNAVAILABLE');
   try{assertAccountEligible(user,restrictions,'redeem rewards',new Date(now));}
   catch{return reply(403,{error:'redemption_restricted'});}
   const result=await redeem(admin,{userId:user.id,rewardId:body.rewardId});
   const row=result?.redemption;
   if(!id(row?.id)||row.user_id!==user.id||row.reward_id!==body.rewardId||!Number.isSafeInteger(row.points_spent)||row.points_spent<0||!['pending','approved'].includes(row.status)||!Number.isSafeInteger(result.balance_after)||result.balance_after<0)throw Error('UNAVAILABLE');
   const receipt=Object.fromEntries(['id','user_id','reward_id','reward_name','points_spent','status','created_date'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));
   return reply(200,{ok:true,redemption:receipt,balance_after:result.balance_after});
  }catch{return reply(503,{error:'reward_redemption_unavailable'});}
 };
}
