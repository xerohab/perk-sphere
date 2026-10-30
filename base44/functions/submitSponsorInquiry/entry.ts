import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {sponsorBody,sponsorUrl} from '../../shared/sponsors.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'unauthorized'},{status:401,headers});
  if(['disabled','suspended','banned'].includes(user.account_status))return Response.json({error:'account_restricted'},{status:403,headers});
  let body;
  try{body=await sponsorBody(req,4096);if(Object.keys(body).sort().join(',')!=='advertiser_name,message,website_url'||typeof body.advertiser_name!=='string'||!body.advertiser_name.trim()||body.advertiser_name.length>100||typeof body.message!=='string'||body.message.trim().length<20||body.message.length>2000)throw Error();body.website_url=sponsorUrl(body.website_url);}catch{return Response.json({error:'invalid_inquiry'},{status:400,headers});}
  if(typeof user.email!=='string'||!/^\S+@\S+\.\S+$/.test(user.email))return Response.json({error:'account_email_required'},{status:409,headers});
  const pending=await client.asServiceRole.entities.SponsorInquiry.filter({user_id:user.id,status:'new'},'-created_date',3);
  if(pending.length>=3)return Response.json({error:'pending_inquiry_limit'},{status:429,headers});
  await client.asServiceRole.entities.SponsorInquiry.create({...body,user_id:user.id,contact_email:user.email,status:'new'});
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'inquiry_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
