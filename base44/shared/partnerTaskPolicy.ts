import {secrets} from 'base44:runtime';
import {fullWatchError} from './fullWatch.ts';
const XERO='630feee8-2649-4c4f-b2a0-c26746a696fd';
const id=value=>typeof value==='string'&&/^[a-f0-9]{24}$/.test(value);
export async function readPartnerTaskPolicy(admin,{taskReference,partnerUuid}){
 if(!id(taskReference)||partnerUuid!==XERO)throw Error('UNSUPPORTED_PARTNER_TASK');
 const task=await admin.entities.Task.get(taskReference);
 if(task?.id!==taskReference||task.reward_processing!=='linux_partner'||task.completion_limit_type!=='once_ever')throw Error('UNSUPPORTED_PARTNER_TASK');
 const partner=await admin.entities.PartnerIntegration.get(task.partner_integration_id);
 if(partner?.linux_api_partner_id!==partnerUuid)throw Error('PARTNER_TASK_MISMATCH');
 const destination=await admin.entities.Website.get(task.destination_id);
 if(task.destination_type!=='website'||String(destination?.domain).replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'')!=='xerostreams.com')throw Error('PARTNER_TASK_DESTINATION_MISMATCH');
 for(const field of ['points_reward','xp_reward'])if(!Number.isSafeInteger(task[field])||task[field]<0||task[field]>1000000)throw Error('INVALID_PARTNER_TASK_REWARD');
 let kind;
 if(task.task_type==='complete_activity'&&task.content_id==='xero-premium-upgrade-v1')kind='premium';
 else if(task.task_type==='watch_video'&&id(task.content_id)){
  kind='native_video';
  if(!Number.isSafeInteger(task.required_seconds)||task.required_seconds<1||task.required_seconds>86400||
   !Number.isSafeInteger(task.content_duration_seconds)||task.content_duration_seconds<task.required_seconds||task.content_duration_seconds>86400||
   ![0,100].includes(task.required_percentage??0)||task.require_continuous===true||
   !/^[a-f0-9]{64}$/.test(task.content_media_url_sha256||'')||!['operator_media_probe','provider_api'].includes(task.content_duration_source)||
   !Number.isFinite(Date.parse(task.content_duration_verified_at))||fullWatchError(task))throw Error('UNVERIFIED_PARTNER_TASK_DURATION');
 }else throw Error('UNSUPPORTED_PARTNER_TASK');
 const enabled=secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true'&&secrets.get('PERKSPHERE_PARTNER_TASKS_ENABLED')==='true'&&
  task.active===true&&task.publicly_visible===true&&!task.archived&&partner.active===true&&partner.integration_status==='active'&&
  destination.status==='active'&&destination.eligibility==='allowed'&&destination.publicly_visible===true&&
  (task.points_reward===0||destination.points_eligible===true)&&(task.xp_reward===0||destination.xp_eligible===true);
 const data={source_revision:'partner-task-policy-v1',task_reference:task.id,partner_uuid:partnerUuid,enabled,kind,
  content_reference:task.content_id,required_seconds:kind==='native_video'?task.required_seconds:0,
  full_content:kind==='native_video'&&task.required_percentage===100,
  content_duration_seconds:kind==='native_video'?task.content_duration_seconds:0,
  media_url_sha256:kind==='native_video'?task.content_media_url_sha256:null,
  points:task.points_reward,xp:task.xp_reward,completion_limit:'once_ever'};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
 return {...data,policy_digest:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),verified_at:new Date().toISOString()};
}
