import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { authorize } from '../../shared/permissions.ts';
import { linuxTrustedPost } from '../../shared/linuxClient.ts';
export default async function(req) {
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try {
  const base44=createClientFromRequest(req);
  const auth=await authorize(base44,'partners.view');
  if(auth.error)return auth.error;
  const body=await req.json();
  if(!body || Object.keys(body).length!==1 || typeof body.partnerId!=='string' || !body.partnerId)return Response.json({error:'Invalid partner request'},{status:400});
  const record=await base44.asServiceRole.entities.PartnerIntegration.get(body.partnerId);
  if(!record?.linux_api_partner_id || !record?.partner_key_id)return Response.json({error:'Partner is not linked to Linux'},{status:409});
  const result=await linuxTrustedPost('/partners/status',{partner_uuid:record.linux_api_partner_id,partner_key_id:record.partner_key_id});
  const state=result.data?.partner;
  if(!result.ok || result.data?.ok!==true || !state || state.partner_uuid!==record.linux_api_partner_id || state.partner_key_id!==record.partner_key_id || typeof state.enabled!=='boolean' || typeof state.verification_enabled!=='boolean' || typeof state.possession_verified!=='boolean' || !/^\d+$/.test(state.verified_link_count))return Response.json({error:'Linux partner status is unavailable'},{status:502});
  // Explicit whitelist; never echo Linux credential or configuration objects.
  return Response.json({partner:{status:state.status,enabled:state.enabled,verification_enabled:state.verification_enabled,credential_status:state.credential_status,possession_verified:state.possession_verified,verified_link_count:state.verified_link_count}});
 }catch{return Response.json({error:'Unable to inspect partner status'},{status:502});}
}
