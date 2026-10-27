import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const user=await createClientFromRequest(req).auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  let enabled=false;try{enabled=secrets.get('PERKSPHERE_DAILY_LOGIN_ENABLED')==='true';}catch{}
  return Response.json({enabled},{headers});
 }catch{return Response.json({enabled:false},{headers});}
}
export default handler;
if(typeof Deno!=='undefined')Deno.serve(handler);
