import {ensureLinuxWallet} from '../../shared/memberWalletEnrollment.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {readLinuxWallet,walletInteger as integer} from '../../shared/walletRead.ts';
async function handleRequest(req:Request) {
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req);const user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({ok:false,error:'unauthorized'},{status:401,headers});
  const body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({ok:false,error:'invalid_request'},{status:400,headers});
  if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true'){
   await ensureLinuxWallet(String(user.id));
   return Response.json({ok:true,data:{...await readLinuxWallet(user.id),user_reference:String(user.id)}},{headers});
  }
  // Explicit pre-cutover mode. Never reached as a fallback to failed Linux reads.
  const [points,xp]=await Promise.all([client.entities.PointsTransaction.filter({user_id:user.id},'-created_date',100),client.entities.XpTransaction.filter({user_id:user.id},'-created_date',100)]);
  return Response.json({ok:true,data:{source:'legacy',user_reference:String(user.id),points_balance:integer(user.points_balance??0,true),loyalty_xp:integer(user.loyalty_xp??0,true),version:null,points:points.map(row=>({...row,amount:integer(row.amount,true)})),xp:xp.map(row=>({...row,xp_amount:integer(row.xp_amount,true)}))}},{headers});
 }catch{return Response.json({ok:false,error:'wallet_unavailable'},{status:503,headers});}
}
export default handleRequest;
if (typeof Deno !== 'undefined') Deno.serve(handleRequest);
