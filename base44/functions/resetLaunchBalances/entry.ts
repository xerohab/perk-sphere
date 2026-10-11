import { createClientFromRequest } from 'npm:@base44/sdk';
import { secrets } from 'base44:runtime';
import { authorize, writeAudit } from '../../shared/permissions.ts';
import { RESET_RUN, FREEZE_KEY, resetMember } from '../../shared/launchBalanceReset.ts';

Deno.serve(async req => {
  const base44 = createClientFromRequest(req);
  const auth = await authorize(base44, 'points.adjust');
  if (auth.error) return auth.error;
  if (!auth.staff.permissions.includes('xp.adjust')) return Response.json({error:'Forbidden'}, {status:403});
  try {
    if (secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE') === 'true') return Response.json({error:'Linux ledger is already authoritative; reset requires a ledger procedure.'}, {status:409});
    const body = await req.json();
    if (!body || !['begin','batch','verify'].includes(body.action) || Object.keys(body).some(k=>!['action','offset'].includes(k))) return Response.json({error:'Invalid reset request'}, {status:400});
    const offset = body.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000 || offset % 25 !== 0) return Response.json({error:'Invalid offset'}, {status:400});
    const admin = base44.asServiceRole;
    const settings = await admin.entities.Setting.filter({key:FREEZE_KEY});
    if (body.action === 'begin') {
      if (!settings.some(row=>row.value==='true')) {
        if (settings.length) await admin.entities.Setting.update(settings[0].id,{value:'true'});
        else await admin.entities.Setting.create({key:FREEZE_KEY,value:'true',category:'launch',description:'PerkSphere balance reset: keep legacy reward writes frozen through ledger cutover.'});
      }
      await writeAudit(admin,{adminId:auth.user.id,action:'launch_balance_reset_begin',entityType:'LaunchBalanceSnapshot',next:{run_reference:RESET_RUN}});
      return Response.json({run_reference:RESET_RUN,frozen:true});
    }
    if (!settings.some(row=>row.value==='true')) return Response.json({error:'Begin the reset first'}, {status:409});
    const users = await admin.entities.User.list('id',25,offset);
    if (body.action === 'batch') {
      const levels = await admin.entities.LoyaltyLevel.list('minimum_xp',100);
      const rank = levels.filter(level=>level.active!==false && (level.minimum_xp??0)<=0).sort((a,b)=>(b.minimum_xp??0)-(a.minimum_xp??0))[0]?.name || 'Bronze';
      for (const user of users) await resetMember(admin,user,auth.user.id,rank);
      await writeAudit(admin,{adminId:auth.user.id,action:'launch_balance_reset_batch',entityType:'LaunchBalanceSnapshot',next:{run_reference:RESET_RUN,offset,count:users.length}});
      return Response.json({run_reference:RESET_RUN,count:users.length,next_offset:offset+25,done:users.length<25});
    }
    const members=[];
    for (const user of users) {
      if ((user.points_balance??0)!==0 || (user.loyalty_xp??0)!==0) throw new Error('nonzero_balance_remains');
      const snapshots=await admin.entities.LaunchBalanceSnapshot.filter({run_reference:RESET_RUN,user_reference:user.id});
      if (snapshots.length!==1 || snapshots[0].state!=='verified') throw new Error('member_reset_not_verified');
      members.push({member_reference:user.id,account_status:user.account_status||'active',points:'0',xp:'0'});
    }
    return Response.json({run_reference:RESET_RUN,members,next_offset:offset+25,done:users.length<25});
  } catch (error) {
    const known=['duplicate_reset_snapshot_review_required','balance_changed_after_reset','reset_verification_failed','nonzero_balance_remains','member_reset_not_verified'];
    return Response.json({error:known.includes(error?.message)?error.message:'Reset could not complete. Retry from the beginning; saved backups are retained.'},{status:409});
  }
});
