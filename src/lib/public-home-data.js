// Public catalogue previews only. This module never awards or redeems rewards.
function inWindow(row,start,end,now){
 for(const key of [start,end])if(row[key]&&!Number.isFinite(Date.parse(row[key])))return false;
 return (!row[start]||Date.parse(row[start])<=now)&&(!row[end]||Date.parse(row[end])>now);
}
export async function loadPublicHomeData(client,now=new Date()){
 const timestamp=now.getTime();
 const sections=[
  ['rewards',()=>client.entities.Reward.filter({active:true},'-created_date',50),rows=>rows.filter(row=>row&&row.active!==false&&inWindow(row,'start_date','end_date',timestamp)&&(row.unlimited_stock||Number.isSafeInteger(row.stock_available)&&row.stock_available>0)).slice(0,8)],
  ['levels',()=>client.entities.LoyaltyLevel.list('display_order',50),rows=>rows.filter(row=>row&&row.active!==false).sort((a,b)=>(a.minimum_xp||0)-(b.minimum_xp||0))],
  ['tasks',()=>client.entities.Task.filter({active:true,publicly_visible:true,featured:true},'-created_date',50),rows=>rows.filter(row=>row&&row.active!==false&&!row.archived&&row.publicly_visible!==false&&row.featured&&inWindow(row,'available_from','available_until',timestamp)&&(row.task_type!=='live_stream'||inWindow(row,'event_start','event_end',timestamp))).slice(0,8)]
 ];
 const results=await Promise.allSettled(sections.map(([,read,select])=>Promise.resolve().then(read).then(rows=>{if(!Array.isArray(rows))throw Error('Invalid public catalogue');return select(rows);})));
 const data={},failed=[];
 results.forEach((result,index)=>{const key=sections[index][0];data[key]=result.status==='fulfilled'?result.value:[];if(result.status==='rejected')failed.push(key);});
 return {data,failed};
}
