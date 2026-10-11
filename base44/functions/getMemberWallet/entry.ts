import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';
function integer(value,signed=false){
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('invalid_ledger_integer');
 const s=String(value);if(!(signed?/^(0|-?[1-9][0-9]*)$/:/^(0|[1-9][0-9]*)$/).test(s))throw Error('invalid_ledger_integer');
 const n=BigInt(s);if(n<-(1n<<63n)||n>(1n<<63n)-1n)throw Error('invalid_ledger_integer');return s;
}
export default async function(req:Request){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req);const user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({ok:false,error:'unauthorized'},{status:401,headers});
  const body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({ok:false,error:'invalid_request'},{status:400,headers});
  if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true'){
   const actor={role:'member',user_reference:String(user.id)};
   const [balance,history]=await Promise.all([linuxTrustedPost('/v1/perk-sphere/ledger/balance',{actor}),linuxTrustedPost('/v1/perk-sphere/ledger/history',{actor})]);
   if(!balance.ok||!history.ok||!balance.data||!Array.isArray(history.data)||history.data.length>100)throw Error('ledger_unavailable');
   const operations=history.data.map(row=>{
    if(typeof row.operation_uuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.operation_uuid)||!['opening_balance','task_reward','partner_reward','manual_adjustment','redemption','reversal'].includes(row.operation_type)||row.status!=='applied'||!Number.isFinite(Date.parse(row.applied_at)))throw Error('invalid_ledger_history');
    return {id:row.operation_uuid,created_date:row.applied_at,transaction_type:row.operation_type,reason:row.operation_type.replace(/_/g,' '),amount:integer(row.points_delta,true),xp_amount:integer(row.xp_delta,true),balance_after:null};
   });
   return Response.json({ok:true,data:{source:'linux',points_balance:integer(balance.data.points_balance),loyalty_xp:integer(balance.data.xp_balance),version:integer(balance.data.version),points:operations.filter(row=>row.amount!=='0'),xp:operations.filter(row=>row.xp_amount!=='0')}},{headers});
  }
  // Explicit pre-cutover mode. Never reached as a fallback to failed Linux reads.
  const [points,xp]=await Promise.all([client.entities.PointsTransaction.filter({user_id:user.id},'-created_date',100),client.entities.XpTransaction.filter({user_id:user.id},'-created_date',100)]);
  return Response.json({ok:true,data:{source:'legacy',points_balance:integer(user.points_balance??0),loyalty_xp:integer(user.loyalty_xp??0),version:null,points:points.map(row=>({...row,amount:integer(row.amount,true)})),xp:xp.map(row=>({...row,xp_amount:integer(row.xp_amount,true)}))}},{headers});
 }catch{return Response.json({ok:false,error:'wallet_unavailable'},{status:503,headers});}
}
