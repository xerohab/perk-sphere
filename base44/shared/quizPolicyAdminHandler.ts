import {validQuizPolicyBody,projectQuizPolicyResult} from './quizPolicyContract.ts';
export function createQuizPolicyAdminHandler({getClient,getSecret,authorize,post}){
 return async req=>{
  const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  let dispatched=false;
  try{
   const client=getClient(req),auth=await authorize(client,'rules.manage');
   if(auth.error){auth.error.headers.set('Cache-Control','no-store');return auth.error;}
   if(!auth.user?.id||auth.user.role!=='admin'||['disabled','suspended','banned'].includes(auth.user.account_status))return reply(403,{error:'forbidden'});
   if(getSecret('PERKSPHERE_QUIZ_ADMIN_ENABLED')!=='true')return reply(503,{error:'quiz_admin_paused'});
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('INVALID_REQUEST');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
   let body;try{body=JSON.parse(text);}catch{return reply(400,{error:'invalid_request'});}
   if(!validQuizPolicyBody(body))return reply(400,{error:'invalid_request'});
   const check=async()=>{const latest=await authorize(client,'rules.manage');if(latest.error||latest.user?.id!==auth.user.id||latest.user?.role!=='admin'||['disabled','suspended','banned'].includes(latest.user?.account_status)||getSecret('PERKSPHERE_QUIZ_ADMIN_ENABLED')!=='true')throw Error('UNAVAILABLE');};
   await check();dispatched=body.action.startsWith('update_');
   const result=await post('/v1/perk-sphere/quiz-rewards/admin',{...body,actor:{role:'admin',user_reference:auth.user.id}});
   await check();
   if(!result?.ok){const safe=new Set(['QUIZ_POLICY_VERSION_CONFLICT','QUIZ_CONTENT_CHANGED','QUIZ_POLICY_LIMITS_REQUIRED','QUIZ_POLICY_SOURCE_NOT_ELIGIBLE','QUIZ_ADMIN_NOT_ENABLED']);return reply(safe.has(result?.code)?409:503,{error:safe.has(result?.code)?result.code:'quiz_admin_unavailable'});}
   return reply(200,{data:projectQuizPolicyResult(result.data,body)});
  }catch{return reply(dispatched?409:503,{error:dispatched?'quiz_policy_update_unconfirmed':'quiz_admin_unavailable'});}
 };
}
