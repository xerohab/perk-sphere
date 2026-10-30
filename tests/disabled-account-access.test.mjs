import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import playGame from '../base44/functions/playGame/entry.ts';
import catalog from '../base44/functions/getGameCatalog/entry.ts';
import {memberRequest,adminRequest,PERK_SPHERE_ENDPOINTS as E} from '../base44/shared/perkSphereClient.ts';
import {assertAccountEligible} from '../base44/shared/rewardPolicy.ts';
import {evaluateAccess} from '../base44/shared/permissions.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const disabled={id:'MEMBER',role:'admin',account_status:'disabled'};
const originalFetch=globalThis.fetch;
function sdk(){return {auth:{me:async()=>disabled},asServiceRole:{entities:{Restriction:{filter:async()=>[]},StaffMember:{filter:async()=>[{active:true,staff_role:'super_admin'}]}}}};}
test('disabled accounts cannot earn or redeem under the shared account policy',()=>{
 for(const operation of ['earn rewards','earn game rewards','redeem rewards'])assert.throws(()=>assertAccountEligible(disabled,[],operation),/not permitted/);
 assert.equal(evaluateAccess(disabled,{role:'super_admin',permissions:['tasks.publish']},'tasks.publish').ok,false);
});
test('disabled accounts cannot enter catalog, play, member or staff API flows',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not contact upstream');};globalThis.__testClient=sdk();
 assert.equal((await catalog(post({}))).status,403);
 assert.equal((await playGame(post({action:'start',game_reference:'quick-maths'}))).status,403);
 assert.equal((await memberRequest(sdk(),E.REPORTS_ARCHIVES,{})).status,403);
 assert.equal((await adminRequest(sdk(),E.QUIZZES_PUBLISH,{quizId:'quiz'},'tasks.publish')).status,403);
 assert.equal(calls,0);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;});
