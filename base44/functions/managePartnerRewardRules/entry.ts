import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { SUPPORTED_EVENT_TYPES } from '../../shared/partners.ts';
import { authorize, writeAudit } from '../../shared/permissions.ts';

// Configuration only. Live issuance is intentionally NOT enabled by this endpoint.
const reverse = new Set(['PURCHASE_REFUNDED', 'CHARGEBACK_ISSUED']);
const invalidate = new Set(['ACCOUNT_DISABLED', 'SUBSCRIPTION_CANCELLED']);
const lifecycle = new Set(['STREAM_STARTED', 'STREAM_ENDED']);
const defaultMode = (type) => reverse.has(type) ? 'reverse' : invalidate.has(type) ? 'invalidate' : lifecycle.has(type) ? 'lifecycle' : 'award';
const safeInt = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const respond = (data, status = 200) => Response.json(data, { status });
async function perkSphereHandler(req) {
  if (req.method !== 'POST') return respond({error:'Method not allowed'},405);
  try {
    const client = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    const auth = await authorize(client, body?.action === 'list' ? 'rules.view' : 'rules.manage');
    if (auth.error) return auth.error;
    const user = auth.user;
    const admin = client.asServiceRole;
    if (!body || typeof body !== 'object' || Array.isArray(body) || !['list','save'].includes(body.action)) return respond({error:'Invalid request'},400);
    const fields = body.action === 'list' ? ['action'] : ['action','partner_id','event_type','mode','enabled','points','xp','daily_limit','cooldown_seconds','min_watch_seconds'];
    if (Object.keys(body).some(key=>!fields.includes(key))) return respond({error:'Unsupported request fields'},400);
    const rows = await admin.entities.PartnerRewardRule.list('-created_date', 1000);
    if (body.action === 'list') return respond({ok:true,rules:rows || [],event_types:SUPPORTED_EVENT_TYPES});
    if (body.action !== 'save') return respond({error:'Invalid action'},400);
    const type = body.event_type;
    if (!SUPPORTED_EVENT_TYPES.includes(type)) return respond({error:'Unknown event type'},400);
    const partnerId = body.partner_id || '';
    if (typeof partnerId !== 'string' || partnerId.length > 150) return respond({error:'Invalid partner'},400);
    if (partnerId) {
      const partner = await admin.entities.PartnerIntegration.get(partnerId).catch(() => null);
      if (!partner) return respond({error:'Partner not found'},404);
    }
    const mode = defaultMode(type);
    if (body.mode !== mode) return respond({error:'This event requires '+mode+' handling'},400);
    if (typeof body.enabled !== 'boolean' || !safeInt(body.points,100000) || !safeInt(body.xp,100000) || !safeInt(body.daily_limit,10000) || !safeInt(body.cooldown_seconds,2592000) || !safeInt(body.min_watch_seconds,86400)) return respond({error:'Invalid reward limits'},400);
    if (mode !== 'award' && (body.points !== 0 || body.xp !== 0)) return respond({error:'This event cannot issue positive rewards'},400);
    const key = (partnerId || 'global')+':'+type;
    const same = (rows || []).filter(r=>r.rule_key===key);
    if (same.length>1) return respond({error:'Duplicate rule records need admin reconciliation'},409);
    const data = {rule_key:key,partner_id:partnerId,event_type:type,enabled:body.enabled,points:mode==='award'?body.points:0,xp:mode==='award'?body.xp:0,daily_limit:body.daily_limit,cooldown_seconds:body.cooldown_seconds,min_watch_seconds:body.min_watch_seconds,mode,updated_by:user.id,updated_at:new Date().toISOString()};
    await writeAudit(admin,{adminId:user.id,action:'partner_rule_update_requested',entityType:'PartnerRewardRule',entityId:same[0]?.id,previous:same[0]||undefined,next:data});
    const saved = same[0] ? await admin.entities.PartnerRewardRule.update(same[0].id,data) : await admin.entities.PartnerRewardRule.create(data);
    await writeAudit(admin,{adminId:user.id,action:'partner_rule_updated',entityType:'PartnerRewardRule',entityId:saved.id,next:data});
    return respond({ok:true,rule:saved,live_issuance_enabled:false});
  } catch (_) { return respond({error:'Unable to manage reward rules'},500); }
}
export default perkSphereHandler;
if (typeof Deno !== 'undefined') Deno.serve(perkSphereHandler);
