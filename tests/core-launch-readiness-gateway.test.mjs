import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import readiness from '../base44/functions/getCoreLaunchReadiness/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;
function fixture(role='super_admin'){
 globalThis.__testClient={auth:{me:async()=>({id:'STAFF',role:'admin'})},asServiceRole:{entities:{StaffMember:{filter:async()=>[{active:true,staff_role:role}]}}}};
 globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic-key',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic signing secret'};
 const bools=keys=>Object.fromEntries(keys.map(key=>[key,true]));
 const data={report_version:1,acceptance_verified:false,configuration_complete:true,enrollment_cutoff_valid:true,enrollment_cutoff_utc:'2026-10-11T00:00:00.000Z',
 flags:bools(['ledger_read','ledger_delivery','games','daily_checkin','new_member_wallets','xp_conversion','xp_conversion_admin','verified_streaks']),
 source_flags:bools(['wallet_authoritative','legacy_writers_frozen','new_member_wallets_enabled','social_source_enabled','social_claims_enabled','partner_tasks_enabled','youtube_configuration_present','x_configuration_present','token_encryption_configuration_present']),
 checks:bools(['ledger','new_member_enrollment','game_rewards','daily_checkin','core_tables']),
 tables:bools(['ps_ledger_accounts','ps_ledger_operations','ps_ledger_entries','ps_ledger_sync_outbox','ps_game_policies','ps_game_sessions']),
 games:[{game_reference:'card-ladder',title:'Card Ladder',enabled:true,required_seconds:60,points:2,xp:5,version:2}],private_detail:'must-not-return'};
 globalThis.fetch=async(url,options)=>{assert.ok(String(url).endsWith('/games/launch-readiness'));assert.deepEqual(JSON.parse(options.body),{action:'read'});return Response.json({ok:true,data});};
 return data;
}
test('launch checks require staff rules-view permission and reject caller overrides',async()=>{
 fixture('support');assert.equal((await readiness(post({}))).status,403);
 fixture();assert.equal((await readiness(post({actor:{role:'admin'}}))).status,400);
 globalThis.__testClient.auth.me=async()=>null;assert.equal((await readiness(post({}))).status,401);
});
test('readiness exposes only whitelisted metadata and never claims acceptance',async()=>{
 const source=fixture();source.flags.private_key='synthetic';const response=await readiness(post({}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const raw=await response.text();assert.doesNotMatch(raw,/private_detail|private_key|must-not-return|synthetic/);assert.equal(JSON.parse(raw).data.acceptance_verified,false);
});
test('unavailable or malformed readiness cannot be displayed as a passed configuration',async()=>{
 const source=fixture();source.checks.new_member_enrollment=false;let response=await readiness(post({}));assert.equal((await response.json()).data.configuration_complete,false);
 source.games[0].points=-1;assert.equal((await readiness(post({}))).status,503);
 fixture();globalThis.fetch=async()=>{throw Error('private error');};response=await readiness(post({}));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private error/);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
