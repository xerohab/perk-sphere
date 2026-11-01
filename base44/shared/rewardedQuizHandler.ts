import {validRewardedQuizBody,projectRewardedQuizResult} from './rewardedQuizContract.ts';
const paths=Object.freeze({catalog:'catalog',questions:'questions',history:'history',submit:'submit'});
const eligible=u=>typeof u?.id==='string'&&/^[A-Za-z0-9_:@.-]{1,191}$/.test(u.id)&&!['disabled','suspended','banned'].includes(u.account_status);
export function createRewardedQuizHandler({getClient,getSecret,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  let dispatched=false;
  try{
   const client=getClient(req),user=await client.auth.me().catch(()=>null);if(!user?.id)return reply(401,{error:'unauthorized'});if(!eligible(user))return reply(403,{error:'forbidden'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)throw Error('INVALID_REQUEST');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
   let body;try{body=JSON.parse(text);}catch{return reply(400,{error:'invalid_request'});}if(!validRewardedQuizBody(body))return reply(400,{error:'invalid_request'});
   const readEnabled=getSecret('PERKSPHERE_QUIZ_MEMBER_READ_ENABLED')==='true',payoutsEnabled=getSecret('PERKSPHERE_QUIZ_REWARDS_ENABLED')==='true';
   if(!readEnabled){if(!['catalog','history'].includes(body.action))return reply(503,{error:'quiz_rewards_paused'});const data=projectRewardedQuizResult({enabled:false,read_only:true,items:[]},body);return reply(200,{data});}
   if(['questions','submit'].includes(body.action)&&!payoutsEnabled)return reply(503,{error:'quiz_rewards_paused'});
   const current=async()=>{const u=await client.auth.me().catch(()=>null);if(!eligible(u)||u.id!==user.id||(getSecret('PERKSPHERE_QUIZ_MEMBER_READ_ENABLED')==='true')!==readEnabled||(getSecret('PERKSPHERE_QUIZ_REWARDS_ENABLED')==='true')!==payoutsEnabled)throw Error('UNAVAILABLE');};
   await current();const {action,...payload}=body;dispatched=action==='submit';
   const result=await post('/v1/perk-sphere/quiz-rewards/'+paths[action],{...payload,actor:{role:'member',user_reference:user.id}});
   await current();
   if(!result?.ok){const safe=new Set(['QUIZ_POLICY_CHANGED','QUIZ_CONTENT_CHANGED','QUIZ_DAILY_LIMIT_REACHED','QUIZ_PREVIOUS_ATTEMPT_REQUIRES_REVIEW','QUIZ_REPLAY_CONFLICT','QUIZ_NOT_AVAILABLE','QUIZ_REWARDS_NOT_ENABLED','QUIZ_MEMBER_READ_NOT_ENABLED']);return reply(safe.has(result?.code)?409:503,{error:safe.has(result?.code)?result.code:dispatched?'quiz_submission_unconfirmed':'quiz_service_unavailable'});}
   const data={...result.data,enabled:true};if(['catalog','questions'].includes(action)){if(typeof data.payouts_enabled!=='boolean')throw Error('INVALID_RESULT');data.payouts_enabled=data.payouts_enabled&&payoutsEnabled;}
   return reply(200,{data:projectRewardedQuizResult(data,body)});
  }catch{return reply(dispatched?409:503,{error:dispatched?'quiz_submission_unconfirmed':'quiz_service_unavailable'});}
 };
}
