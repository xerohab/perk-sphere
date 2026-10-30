// Optional dashboard sections fail independently; wallet data has its own authority.
export async function loadDashboardData(client,userId){
 if(typeof userId!=='string'||!userId)throw Error('Authenticated member required');
 const sources=[
  ['levels',()=>client.entities.LoyaltyLevel.list('-minimum_xp',50)],
  ['activities',()=>client.entities.Activity.filter({user_id:userId},'-created_date',6)],
  ['rewards',()=>client.entities.Reward.list('-created_date',4)],
  ['achievements',()=>client.entities.UserAchievement.filter({user_id:userId},'-created_date',4)],
  ['tasks',()=>client.entities.Task.list('-created_date',20)],
  ['taskProgress',()=>client.entities.TaskProgress.filter({user_id:userId})]
 ];
 const results=await Promise.allSettled(sources.map(([,run])=>Promise.resolve().then(run).then(rows=>{if(!Array.isArray(rows))throw Error('Invalid dashboard section');return rows;})));
 const data={},failed=[];
 results.forEach((r,i)=>{const key=sources[i][0];data[key]=r.status==='fulfilled'?r.value:[];if(r.status!=='fulfilled')failed.push(key);});
 return {data,failed};
}
