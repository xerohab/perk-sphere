import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../base44/functions/perkSphereQuizzes/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;
const member={id:'MEMBER',role:'user'};
function client(user=member){globalThis.__testClient={auth:{me:async()=>user}};}
test('quiz gateway requires POST and authentication and never caches responses',async()=>{
 client(null);let response=await handler(post({action:'history'}));assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');
 response=await handler(new Request('https://test.invalid'));assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'POST');assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('malformed quiz requests and browser identity fields fail before upstream calls',async()=>{
 client();let called=0;globalThis.fetch=async()=>{called++;throw Error('should not call');};
 for(const body of [null,[],{action:'history',actor:{role:'admin'}},{action:'history',user_id:'OTHER'},{action:'create',quiz:{title:'Example',video_ref:'video',questions:[null]}}]){
  const response=await handler(post(body));assert.equal(response.status,400);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }assert.equal(called,0);
});
test('invalid correct answers and oversized question sets cannot reach the admin API',async()=>{
 client();const question={text:'Choose',choices:['A','B'],correct_choice:0};
 for(const patch of [{correct_choice:-1},{correct_choice:2},{correct_choice:0.5},{choices:['A',null]}]){
  assert.equal((await handler(post({action:'create',quiz:{title:'Example',video_ref:'video',questions:[{...question,...patch}]}}))).status,400);
 }
 assert.equal((await handler(post({action:'create',quiz:{title:'Example',video_ref:'video',questions:Array(31).fill(question)}}))).status,400);
});
test('valid member quiz operations retain the authenticated actor and expected API contracts',async()=>{
 client();globalThis.__testSecrets={PERKSPHERE_LINUX_KEY_ID:'synthetic-key',PERKSPHERE_LINUX_HMAC_SECRET:'synthetic test credential'};
 let sent;
 globalThis.fetch=async(url,init)=>{sent={url:String(url),body:JSON.parse(init.body)};return Response.json({ok:true,questions:[]});};
 for(const [body,suffix] of [[{action:'list'},'/quizzes/list'],[{action:'questions',quizId:'quiz'},'/quizzes/questions'],[{action:'history'},'/grading/history'],[{action:'submit',quizId:'quiz',answers:[{question_uuid:'question',selected_index:0}]},'/grading/submit']]){
  const response=await handler(post(body));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.ok(sent.url.endsWith(suffix));assert.deepEqual(sent.body.actor,{user_reference:'MEMBER',role:'member'});
 }
});
test('ordinary members cannot publish or list drafts',async()=>{
 client();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 for(const body of [{action:'publish',quizId:'quiz'},{action:'list',scope:'all'}])assert.equal((await handler(post(body))).status,403);
 assert.equal(calls,0);
});
test('backend exceptions are redacted and cannot return private diagnostics',async()=>{
 client({id:'ADMIN',role:'admin'});
 globalThis.__testClient.asServiceRole={entities:{StaffMember:{filter:async()=>{throw Error('private provider payload');}}}};
 // A deliberately broken SDK permission service is not returned to the browser.
 const response=await handler(post({action:'publish',quizId:'quiz'}));
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private provider payload/);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__testClient;delete globalThis.__testSecrets;});
