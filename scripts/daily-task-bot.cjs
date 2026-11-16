'use strict';
// Run on the existing API host. Uses its HMAC bridge, never browser credentials.
// A durable claim is synced BEFORE each remote create. An uncertain dispatch is
// never sent again automatically, even after a crash or on tomorrow's scan.
const fs=require('node:fs'),path=require('node:path');
function syncDir(directory){const fd=fs.openSync(directory,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function claimFile(file,data){let fd;try{fd=fs.openSync(file,'wx',0o600);}catch(e){if(e.code==='EEXIST')return false;throw e;}try{fs.writeFileSync(fd,JSON.stringify(data)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}syncDir(path.dirname(file));return true;}
async function runDailyTaskBot({send,stateDir,now=Date.now(),dryRun=false}){
 const response=await send({action:'task_bot_plan'}),plan=response?.body?.data;
 if(!response?.ok||response.body?.ok!==true||plan?.publication_mode!=='private_drafts_only'||!Array.isArray(plan.candidates)||plan.candidates.length>30||plan.source?.source_key!=='xerostreams'||!Number.isSafeInteger(plan.source.daily_max)||plan.source.daily_max<1||plan.source.daily_max>5||!Number.isFinite(Date.parse(plan.generated_at))||Math.abs(Date.parse(plan.generated_at)-now)>60000)throw Error('INVALID_TASK_BOT_PLAN');
 if(dryRun)return {status:'preview',candidates:plan.candidates.length,enabled:plan.source.enabled,publication_mode:plan.publication_mode};
 fs.mkdirSync(stateDir,{recursive:true,mode:0o700});const day=new Date(now).toISOString().slice(0,10),result={status:'completed',created:0,existing:0,held:0,skipped:0,candidates:plan.candidates.length};
 for(const candidate of plan.candidates){
  if(!/^xerostreams:[a-f0-9]{24}$/.test(candidate.generation_key||''))throw Error('INVALID_TASK_BOT_KEY');
  const file=path.join(stateDir,candidate.generation_key.replace(':','-')+'.json');
  if(fs.existsSync(file)){result.skipped++;continue;}
  let slot=false;for(let n=1;n<=plan.source.daily_max;n++){if(claimFile(path.join(stateDir,`${day}-slot-${n}.json`),{generation_key:candidate.generation_key})){slot=true;break;}}
  if(!slot)break;
  if(!claimFile(file,{status:'uncertain_until_confirmed',day,generation_key:candidate.generation_key})){result.skipped++;continue;}
  try{
   const reply=await send({action:'task_bot_create_draft',generation_key:candidate.generation_key}),data=reply?.body?.data;
   if(!reply?.ok||reply.body?.ok!==true||! /^[a-f0-9]{24}$/.test(data?.task_id||'')||typeof data.existing!=='boolean')throw Error('DRAFT_NOT_CONFIRMED');
   const temp=file+'.confirmed';claimFile(temp,{status:'confirmed',day,generation_key:candidate.generation_key,task_id:data.task_id});fs.renameSync(temp,file);syncDir(stateDir);result[data.existing?'existing':'created']++;
  }catch{result.held++;}
 }
 return result;
}
if(require.main===module){
 require('/home/perksphere/api/node_modules/dotenv').config({path:'/home/perksphere/api/.env',quiet:true});
 const {requestLaunchSource}=require('/home/perksphere/api/lib/launch-source-client');
 runDailyTaskBot({send:requestLaunchSource,stateDir:'/var/lib/perksphere-task-bot',dryRun:process.argv.includes('--preview')}).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('TASK_BOT_SCAN_FAILED: check catalog/source availability; no automatic redispatch of held drafts.');process.exitCode=1;});
}
module.exports={runDailyTaskBot};
