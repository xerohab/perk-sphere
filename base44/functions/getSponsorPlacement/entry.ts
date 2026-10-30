import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {sponsorBody,publicSponsor} from '../../shared/sponsors.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 let body;try{body=await sponsorBody(req,128);if(Object.keys(body).join(',')!=='slot'||!['home','games'].includes(body.slot))throw Error();}catch{return Response.json({error:'invalid_request'},{status:400,headers});}
 try{
  const client=createClientFromRequest(req);
  const rows=await client.asServiceRole.entities.SponsorPlacement.filter({slot:body.slot,status:'active'},'-created_date',100);
  if(!Array.isArray(rows)||rows.length>=100)throw Error();
  const data=rows.map(row=>publicSponsor(row)).find(Boolean)||null;
  return Response.json({ok:true,data},{headers});
 }catch{return Response.json({error:'sponsor_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
