import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {authorize} from '../../shared/permissions.ts';
import {NATIVE_GAME_IDS} from '../../shared/nativeGames.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
const FLAG_KEYS=['ledger_read','ledger_delivery','games','daily_checkin','missed_login','new_member_wallets','xp_conversion','xp_conversion_admin','verified_streaks'];
const SOURCE_KEYS=['wallet_authoritative','legacy_writers_frozen','new_member_wallets_enabled','social_source_enabled','social_claims_enabled','partner_tasks_enabled','youtube_configuration_present','x_configuration_present','token_encryption_configuration_present'];
const CHECK_KEYS=['ledger','new_member_enrollment','game_rewards','daily_checkin','daily_presence','core_tables'];
const TABLE_KEYS=['ps_ledger_accounts','ps_ledger_operations','ps_ledger_entries','ps_ledger_sync_outbox','ps_game_policies','ps_game_sessions','ps_daily_login_presence'];
function booleans(value,keys){if(!value||keys.some(key=>typeof value[key]!=='boolean'))throw Error('INVALID_READINESS');return Object.fromEntries(keys.map(key=>[key,value[key]]));}
async function handler(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
 try{
  const access=await authorize(createClientFromRequest(req),'rules.view');if(access.error){access.error.headers.set('Cache-Control','no-store');return access.error;}
  const body=await req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({error:'invalid_request'},{status:400,headers});
  const result=await linuxTrustedPost('/v1/perk-sphere/games/launch-readiness',{action:'read'});
  const data=result.data;
  if(!result.ok||data?.report_version!==1||data.acceptance_verified!==false||typeof data.enrollment_cutoff_valid!=='boolean'||!Array.isArray(data.games)||data.games.length>NATIVE_GAME_IDS.length)throw Error('INVALID_READINESS');
  const flags=booleans(data.flags,FLAG_KEYS),source_flags=booleans(data.source_flags,SOURCE_KEYS),checks=booleans(data.checks,CHECK_KEYS),tables=booleans(data.tables,TABLE_KEYS);
  const games=data.games.map(row=>{
   if(!row||!NATIVE_GAME_IDS.includes(row.game_reference)||typeof row.title!=='string'||row.title.length>100||typeof row.enabled!=='boolean'||![row.required_seconds,row.points,row.xp,row.version].every(Number.isSafeInteger)||row.required_seconds<60||row.required_seconds>3600||row.points<0||row.xp<0||row.points>1000000||row.xp>1000000||row.version<1)throw Error('INVALID_READINESS');
   return {game_reference:row.game_reference,title:row.title,enabled:row.enabled,required_seconds:row.required_seconds,points:row.points,xp:row.xp,version:row.version};
  });
  if(new Set(games.map(row=>row.game_reference)).size!==games.length)throw Error('INVALID_READINESS');
  const cutoff=data.enrollment_cutoff_valid===true&&typeof data.enrollment_cutoff_utc==='string'&&Number.isFinite(Date.parse(data.enrollment_cutoff_utc))?data.enrollment_cutoff_utc:null;
  return Response.json({data:{report_version:1,flags,source_flags,checks,tables,games,enrollment_cutoff_valid:data.enrollment_cutoff_valid,enrollment_cutoff_utc:cutoff,configuration_complete:Object.values(checks).every(Boolean),acceptance_verified:false}},{headers});
 }catch{return Response.json({error:'launch_checks_unavailable'},{status:503,headers});}
}
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
