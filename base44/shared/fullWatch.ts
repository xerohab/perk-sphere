export function fullWatchRewards(seconds){
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>86400)throw Error('Verified content duration required');
 const minutes=Math.ceil(seconds/60);return {points:minutes*2,xp:minutes*4};
}
export function fullWatchError(task){
 if(task?.task_type!=='watch_video'||task.required_percentage!==100)return null;
 if(!Number.isSafeInteger(task.content_duration_seconds)||task.content_duration_seconds<1||task.content_duration_seconds>86400||
  task.required_seconds!==task.content_duration_seconds||!['operator_media_probe','provider_api'].includes(task.content_duration_source)||
  typeof task.content_duration_verified_at!=='string'||!Number.isFinite(Date.parse(task.content_duration_verified_at)))return 'Full-video tasks require a verified duration and a matching watch-time requirement.';
 return null;
}
export function taskActivationError(task){
 if(task?.reward_processing==='linux_partner')return 'Partner task rewards are not activated. Complete the independent transactional verification integration before publishing.';
 return fullWatchError(task);
}
