// Staged read-only administrator gateway; no deployed endpoint or Deno.serve.
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../base44/shared/permissions.ts';
import {linuxTrustedPost} from '../../base44/shared/linuxClient.ts';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const count=v=>typeof v==='string'&&/^\d{1,20}$/.test(v);
export default async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const access=await authorize(createClientFromRequest(req),'partners.view');
  if(access.error){access.error.headers.set('Cache-Control','no-store');return access.error;}
  const b=await req.json().catch(()=>null);
  if(!b||Array.isArray(b)||Object.keys(b).sort().join(',')!=='environment,limit,offset'||!['live','sandbox'].includes(b.environment)||!Number.isInteger(b.limit)||b.limit<1||b.limit>100||!Number.isInteger(b.offset)||b.offset<0||b.offset>10000)return Response.json({error:'invalid_request'},{status:400,headers});
  const result=await linuxTrustedPost('/v1/perk-sphere/legacy-subscription-review/queue',{actor:{user_reference:String(access.user.id),role:'admin'},environment:b.environment,limit:b.limit,offset:b.offset});
  const d=result.data;
  if(!result.ok||d?.read_only!==true||d.environment!==b.environment||d.limit!==b.limit||d.offset!==b.offset||d.recovery_enabled!==false||d.acceptance_verified!==false||typeof d.has_more!=='boolean'||!count(d.counts?.processing)||!count(d.counts?.review)||!Array.isArray(d.items)||d.items.length>b.limit)throw Error('INVALID_REVIEW');
  const items=d.items.map(r=>{
   if(!id(r.event_reference)||typeof r.event_type!=='string'||!/^[A-Z0-9_.]{1,100}$/.test(r.event_type)||!['processing','review'].includes(r.status)||!count(r.age_seconds)||!(r.scope_hash===null||typeof r.scope_hash==='string'&&/^[0-9a-f]{64}$/.test(r.scope_hash))||![null,'idle','processing','review'].includes(r.guard_status)||typeof r.scope_consistent!=='boolean')throw Error('INVALID_REVIEW');
   return {event_reference:r.event_reference,event_type:r.event_type,status:r.status,age_seconds:r.age_seconds,scope_hash:r.scope_hash,guard_status:r.guard_status,scope_consistent:r.scope_consistent};
  });
  if(new Set(items.map(r=>r.event_reference)).size!==items.length)throw Error('INVALID_REVIEW');
  return Response.json({data:{read_only:true,environment:b.environment,limit:b.limit,offset:b.offset,counts:{processing:d.counts.processing,review:d.counts.review},items,has_more:d.has_more,recovery_enabled:false,acceptance_verified:false}},{headers});
 }catch{return Response.json({error:'subscription_review_unavailable'},{status:503,headers});}
}
