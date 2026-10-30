import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize,writeAudit} from '../../shared/permissions.ts';
import {sponsorBody,validateSponsor} from '../../shared/sponsors.ts';
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const client=createClientFromRequest(req),access=await authorize(client,'campaigns.manage');if(access.error)return access.error;
  const body=await sponsorBody(req),admin=client.asServiceRole;
  if(body.action==='list'&&Object.keys(body).length===1){
   const [placements,inquiries]=await Promise.all([admin.entities.SponsorPlacement.list('-created_date',100),admin.entities.SponsorInquiry.list('-created_date',100)]);
   return Response.json({ok:true,placements,inquiries},{headers});
  }
  if(body.action==='create'&&Object.keys(body).sort().join(',')==='action,placement,reason'){
   if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)return Response.json({error:'reason_required'},{status:400,headers});
   let policy;try{policy=validateSponsor(body.placement);}catch{return Response.json({error:'invalid_booking_or_confirmation'},{status:400,headers});}
   // Draft first: audit failure cannot publish an advert. Booking confirmation is
   // an operator declaration, not a provider-verified payment or financial ledger.
   const row=await admin.entities.SponsorPlacement.create({...policy,status:'draft',created_by:access.user.id});
   await writeAudit(admin,{adminId:access.user.id,action:'sponsor_booking_requested',entityType:'SponsorPlacement',entityId:row.id,next:{...policy,reason:body.reason}});
   if(policy.status==='active')await admin.entities.SponsorPlacement.update(row.id,{status:'active'});
   return Response.json({ok:true,id:row.id,status:policy.status},{headers});
  }
  if(['pause','closeInquiry'].includes(body.action)&&Object.keys(body).sort().join(',')==='action,id'&&typeof body.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(body.id)){
   const entity=body.action==='pause'?'SponsorPlacement':'SponsorInquiry',row=await admin.entities[entity].get(body.id),status=body.action==='pause'?'paused':'closed';
   if(!row||row.id!==body.id)throw Error();
   if(row.status===status)return Response.json({ok:true,unchanged:true},{headers});
   await writeAudit(admin,{adminId:access.user.id,action:'sponsor_'+body.action+'_requested',entityType:entity,entityId:row.id,previous:{status:row.status},next:{status}});
   await admin.entities[entity].update(row.id,{status});return Response.json({ok:true},{headers});
  }
  return Response.json({error:'invalid_request'},{status:400,headers});
 }catch{return Response.json({error:'sponsor_management_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
