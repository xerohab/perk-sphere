export async function loadConnectionSettings(client,userId){
 const results=await Promise.allSettled([
  Promise.resolve().then(()=>client.entities.ConnectedService.filter({user_id:userId},'-created_date',50)).then(rows=>{if(!Array.isArray(rows))throw Error('Invalid connections');return rows;}),
  Promise.resolve().then(()=>client.functions.invoke('oauthConfig',{})).then(response=>{
   const body=response.data;
   if(body?.ok!==true||!body.providers||['google','youtube','x'].some(key=>typeof body.providers[key]?.configured!=='boolean'))throw Error('Invalid configuration status');
   return body.providers;
  })
 ]);
 return {connections:results[0].status==='fulfilled'?results[0].value:[],config:results[1].status==='fulfilled'?results[1].value:{},connectionsUnavailable:results[0].status==='rejected',configurationUnavailable:results[1].status==='rejected'};
}
export function connectionDisplayState(rows,provider,userId,now=Date.now()){
 const matches=rows.filter(row=>row.service===provider&&row.user_id===userId);
 const connection=matches[0];
 const ambiguous=matches.length>1;
 const expired=connection?.token_expiry!=null&&(!Number.isFinite(Date.parse(connection.token_expiry))||Date.parse(connection.token_expiry)<=now);
 const canDisconnect=matches.some(row=>!row.revoked_at&&['connected','pending'].includes(row.status));
 const isConnected=!ambiguous&&connection?.status==='connected'&&!connection.revoked_at&&!expired;
 return {connection,isConnected,canDisconnect,requiresReview:ambiguous,needsReconnect:ambiguous||canDisconnect&&!isConnected};
}
