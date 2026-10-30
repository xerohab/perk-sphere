import {canCompleteAgain,isInCooldown} from '../../base44/shared/tasks.ts';

const time = value => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; };
// Display only. The authenticated completion endpoint remains the reward authority.
export function memberTaskState(task,records=[],now=new Date()){
 if(!task||task.active===false||task.archived||task.publicly_visible===false)return {status:'hidden',progress:null};
 if((task.available_until&&new Date(task.available_until)<now)||(task.task_type==='live_stream'&&task.event_end&&new Date(task.event_end)<now))return {status:'expired',progress:null};
 if((task.available_from&&new Date(task.available_from)>now)||(task.task_type==='live_stream'&&task.event_start&&new Date(task.event_start)>now))return {status:'upcoming',progress:null};
 const own=records.filter(p=>p.task_id===task.id);
 const completed=own.filter(p=>p.status==='completed').sort((a,b)=>time(a.completed_at)-time(b.completed_at));
 const last=completed.at(-1);
 if(!canCompleteAgain(task,completed,now).ok||last&&isInCooldown(last.completed_at,task.cooldown_seconds,now))return {status:'completed',progress:last||null};
 const active=own.filter(p=>p.status==='in_progress').sort((a,b)=>time(b.last_activity||b.started_at||b.created_date)-time(a.last_activity||a.started_at||a.created_date))[0];
 if(active)return {status:'in_progress',progress:active};
 return {status:'available',progress:null};
}
