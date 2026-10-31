import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {authorize} from '../../shared/permissions.ts';
import {readLinuxWallet,walletInteger} from '../../shared/walletRead.ts';

async function handleRequest(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),auth=await authorize(client,'ledger.view');
  if(auth.error)return auth.error;
  if(!auth.staff.permissions.includes('users.view'))return Response.json({ok:false,error:'forbidden'},{status:403,headers});
  const body=await req.json();
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||typeof body.userId!=='string'||!/^[A-Za-z0-9_-]{1,191}$/.test(body.userId))return Response.json({ok:false,error:'invalid_request'},{status:400,headers});
  const admin=client.asServiceRole,user=await admin.entities.User.get(body.userId).catch(()=>null);
  if(!user||user.id!==body.userId)return Response.json({ok:false,error:'member_not_found'},{status:404,headers});
  if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true'){
   return Response.json({ok:true,data:await readLinuxWallet(user.id)},{headers});
  }
  const [points,xp]=await Promise.all([admin.entities.PointsTransaction.filter({user_id:user.id},'-created_date',100),admin.entities.XpTransaction.filter({user_id:user.id},'-created_date',100)]);
  return Response.json({ok:true,data:{source:'legacy',points_balance:walletInteger(user.points_balance??0,true),loyalty_xp:walletInteger(user.loyalty_xp??0,true),version:null,points:points.map(row=>({...row,amount:walletInteger(row.amount,true)})),xp:xp.map(row=>({...row,xp_amount:walletInteger(row.xp_amount,true)}))}},{headers});
 }catch{return Response.json({ok:false,error:'wallet_unavailable'},{status:503,headers});}
}
export default handleRequest;
if(typeof Deno!=='undefined')Deno.serve(handleRequest);