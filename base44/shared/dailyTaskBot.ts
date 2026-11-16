// Initial adapter is deliberately fixed to the approved first-party catalog.
// Page titles are plain text, never prompts, code or instructions.
export const CATALOG_URL='https://xerostreams.com/api/apps/69e793d6b51b4ec30a25aa0b/functions/perkSphereTaskCatalog';
const id=value=>typeof value==='string'&&/^[a-f0-9]{24}$/.test(value);
export const defaultBotSource=Object.freeze({source_key:'xerostreams',enabled:true,mode:'alternate',partial_seconds:300,daily_max:2,lookback_days:14});
export function botSource(value){
 if(!value||value.source_key!=='xerostreams'||typeof value.enabled!=='boolean'||!['partial','full_episode','alternate'].includes(value.mode)||!Number.isSafeInteger(value.partial_seconds)||value.partial_seconds<60||value.partial_seconds>1800||!Number.isSafeInteger(value.daily_max)||value.daily_max<1||value.daily_max>5||!Number.isSafeInteger(value.lookback_days)||value.lookback_days<1||value.lookback_days>14)throw Error('Invalid task bot source controls');
 const {source_key,enabled,mode,partial_seconds,daily_max,lookback_days}=value;return {source_key,enabled,mode,partial_seconds,daily_max,lookback_days};
}
export async function loadBotSource(admin){const rows=await admin.entities.TaskBotSource.filter({source_key:'xerostreams'},'-created_date',2);if(rows.length>1)throw Error('Duplicate source controls require review');return {source:botSource(rows[0]||defaultBotSource),record:rows[0]||null};}
export async function readCatalog({fetchImpl=fetch}={}){
 const response=await fetchImpl(CATALOG_URL,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('XeroStreams catalog is unavailable');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty catalog');let bytes=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>65536)throw Error('Catalog exceeds limit');raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
 const body=JSON.parse(raw);if(body?.ok!==true||body.source!=='xerostreams'||body.revision!=='task-catalog-v1'||!Array.isArray(body.items)||body.items.length>30)throw Error('Invalid catalog');return body.items;
}
export function botCandidates(source,items,now=Date.now()){
 const config=botSource(source);if(!config.enabled)return [];
 const mode=config.mode==='alternate'?(Math.floor(now/86400000)%2?'full_episode':'partial'):config.mode,seen=new Set();
 return items.filter(item=>{
  if(!id(item?.content_id)||seen.has(item.content_id)||!['movie','episode'].includes(item.content_type)||typeof item.title!=='string'||!item.title.trim()||item.title.length>160||item.content_url!==`https://xerostreams.com/Watch?id=${item.content_id}`||!Number.isFinite(Date.parse(item.updated_at))||Date.parse(item.updated_at)>now||Date.parse(item.updated_at)<now-config.lookback_days*86400000||mode==='full_episode'&&item.content_type!=='episode')return false;
  const d=item.duration;if(d!==null&&(!d||!Number.isSafeInteger(d.seconds)||d.seconds<1||d.seconds>86400||!['operator_media_probe','provider_api'].includes(d.source)||!Number.isFinite(Date.parse(d.verified_at))||Date.parse(d.verified_at)>now||! /^[a-f0-9]{64}$/.test(d.media_url_sha256||'')))return false;
  if(mode==='partial'&&d&&d.seconds<config.partial_seconds)return false;
  seen.add(item.content_id);return true;
 }).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.content_id.localeCompare(b.content_id)).map(item=>({
  ...item,mode,required_seconds:mode==='full_episode'?(item.duration?.seconds||0):config.partial_seconds,
  // Content-scoped, not date-scoped: edits and tomorrow's scan cannot reset it.
  generation_key:`xerostreams:${item.content_id}`,
  review_note:item.duration?'Confirm rewards, current destination eligibility, player binding and worker registration before publishing.':'Verify the media duration first, then confirm rewards, destination eligibility, player binding and worker registration.'
 }));
}

const CACHE_KEY='perksphere_task_bot_xerostreams_catalog_v1';
export async function refreshBotCatalog(admin,items,capturedAt,{now=Date.now()}={}){
 if(!Array.isArray(items)||items.length>30||!Number.isFinite(Date.parse(capturedAt))||Math.abs(Date.parse(capturedAt)-now)>60000)throw Error('Invalid catalog snapshot');
 // Revalidate all data from the fixed first-party fetch. Discard undeclared fields.
 const valid=botCandidates({...defaultBotSource,mode:'partial',partial_seconds:60},items,now).map(c=>({content_id:c.content_id,title:c.title,content_type:c.content_type,content_url:c.content_url,updated_at:c.updated_at,duration:c.duration?{seconds:c.duration.seconds,source:c.duration.source,verified_at:c.duration.verified_at,media_url_sha256:c.duration.media_url_sha256}:null}));
 const rows=await admin.entities.Setting.filter({key:CACHE_KEY},'-created_date',2);if(rows.length>1)throw Error('Duplicate catalog snapshots require review');
 const value=JSON.stringify({captured_at:capturedAt,items:valid});
 if(rows.length)await admin.entities.Setting.update(rows[0].id,{value});else await admin.entities.Setting.create({key:CACHE_KEY,value,category:'task_bot',description:'Sanitized catalog metadata fetched by the authenticated Linux task runner. No credentials or playback URLs.'});
 return {cached_items:valid.length};
}
async function cachedBotCatalog(admin,now){
 const rows=await admin.entities.Setting.filter({key:CACHE_KEY},'-created_date',2);if(rows.length!==1)throw Error('Catalog snapshot unavailable');
 const snapshot=JSON.parse(rows[0].value);if(!Number.isFinite(Date.parse(snapshot.captured_at))||Date.parse(snapshot.captured_at)>now||now-Date.parse(snapshot.captured_at)>26*3600000||!Array.isArray(snapshot.items)||snapshot.items.length>30)throw Error('Catalog snapshot expired');
 return snapshot.items;
}
export async function botPlan(admin,{fetchImpl,now=Date.now()}={}){
 let source;try{({source}=await loadBotSource(admin));}catch{throw Error('task_bot_source_unavailable');}
 let candidates=[];if(source.enabled){let items;try{items=fetchImpl?await readCatalog({fetchImpl}):await cachedBotCatalog(admin,now);}catch{throw Error('task_bot_catalog_unavailable');}try{candidates=botCandidates(source,items,now);}catch{throw Error('task_bot_candidates_unavailable');}}
 return {source,candidates,generated_at:new Date(now).toISOString(),publication_mode:'private_drafts_only'};
}
export async function createBotDraft(admin,generationKey,{fetchImpl,now=Date.now()}={}){
 if(typeof generationKey!=='string'||!/^xerostreams:[a-f0-9]{24}$/.test(generationKey))throw Error('Invalid content reference');
 const existing=await admin.entities.Task.filter({bot_generation_key:generationKey},'-created_date',2);
 if(existing.length>1)throw Error('Duplicate drafts require review');if(existing.length===1)return {task_id:existing[0].id,existing:true};
 const plan=await botPlan(admin,{fetchImpl,now}),candidate=plan.candidates.find(c=>c.generation_key===generationKey);if(!candidate)throw Error('Content no longer eligible for drafting');
 const destinations=await admin.entities.Website.filter({domain:'xerostreams.com'},'-created_date',2);
 if(destinations.length!==1||destinations[0].eligibility!=='allowed'||destinations[0].status==='inactive'||destinations[0].tracking_enabled===false)throw Error('An enabled Allowed XeroStreams destination is required');
 const website=destinations[0],d=candidate.duration;
 const task=await admin.entities.Task.create({name:`${candidate.mode==='full_episode'?'Watch the full episode':'Watch '+candidate.required_seconds+' seconds'}: ${candidate.title}`,
 description:candidate.review_note,task_type:'watch_video',destination_type:'website',destination_id:website.id,destination_name:website.site_name||'XeroStreams',destination_platform:'website',content_id:candidate.content_id,content_url:candidate.content_url,content_title:candidate.title,
 required_seconds:candidate.required_seconds,required_percentage:candidate.mode==='full_episode'?100:0,require_continuous:false,completion_mode:'fixed_duration',completion_limit_type:'once_ever',verification_mode:'trusted_automatic',reward_processing:'linux_partner',
 points_reward:0,xp_reward:0,reward_type:'none',active:false,publicly_visible:false,archived:false,featured:false,
 bot_generation_key:candidate.generation_key,bot_review_required:true,bot_review_note:candidate.review_note,
 ...(d?{content_duration_seconds:d.seconds,content_duration_source:d.source,content_duration_verified_at:d.verified_at,content_media_url_sha256:d.media_url_sha256}:{})});
 return {task_id:task.id,existing:false};
}
