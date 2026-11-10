import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {createGiftSourceAuthorityHandler} from '../base44/shared/giftSourceAuthorityHandler.ts';
import entry from '../base44/functions/trustedGiftSourceAuthority/entry.ts';
const scope={mode:'sandbox',merchantReference:'MERCHANT',webhookReference:'HOOK'},now=Date.now();
const payload=()=>({userReference:'OPERATOR',permission:'gift_notification_sources:manage',source:scope,requestReference:randomUUID(),expiresAt:new Date(now+20000).toISOString()});
const request=(body=payload(),headers={})=>new Request('https://test.invalid/run/internal',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
function fixture(patch={}){
 let reads=0;const user={id:'OPERATOR',role:'admin'},staff={active:true,staff_role:'super_admin'},env={PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED:'true'};
 const admin={entities:{User:{get:async()=>{reads++;return {...user};}},StaffMember:{filter:async()=>[{...staff}]}}};
 const options={getClient:()=>({asServiceRole:admin}),getSecret:n=>env[n],verify:async req=>({ok:true,rawBody:await req.text()}),clock:()=>now,...patch};
 return {handler:createGiftSourceAuthorityHandler(options),user,staff,env,reads:()=>reads};
}
test('authority function authenticates trusted Linux request before accessing staff records',async()=>{
 const s=fixture({verify:async()=>({ok:false,status:401})}),r=await s.handler(request());assert.equal(r.status,401);assert.equal(s.reads(),0);assert.match(r.headers.get('cache-control'),/no-store/);
});
test('authority checks current assigned permissions and does not trust an admin account alone',async()=>{
 for(const role of ['admin','rewards_manager','support','analyst']){const s=fixture();s.staff.staff_role=role;const r=await s.handler(request());assert.equal(r.status,200);assert.equal((await r.json()).data.authorized,false);}
 const s=fixture(),r=await s.handler(request());assert.equal((await r.json()).data.authorized,true);
});
test('suspended, missing or mismatched operators and revoked staff cannot authorize a source',async()=>{
 for(const mutate of [s=>s.user.account_status='suspended',s=>s.user.id='OTHER',s=>s.staff.active=false,s=>s.user.role='user']){const s=fixture();mutate(s);assert.equal((await (await s.handler(request())).json()).data.authorized,false);}
});
test('expired/overlong grants, extra fields and unsupported permission never read users',async()=>{
 for(const change of [b=>b.expiresAt=new Date(now).toISOString(),b=>b.expiresAt=new Date(now+31000).toISOString(),b=>b.permission='settings.manage',b=>b.actor='OTHER',b=>b.source.token='PRIVATE']){
  const s=fixture(),b=payload();b.source={...scope};change(b);assert.ok([400,403].includes((await s.handler(request(b))).status));assert.equal(s.reads(),0);
 }
});
test('authority request body and MIME are bounded and private errors are not reflected',async()=>{
 const s=fixture();
 for(const [req,status] of [[request('x'.repeat(4097)),413],[request(payload(),{'Content-Type':'text/plain'}),415],[request(payload(),{'Content-Encoding':'gzip'}),415]]){
  const r=await s.handler(req);assert.equal(r.status,status);assert.doesNotMatch(await r.text(),/PRIVATE|stack/);
 }
 assert.equal(s.reads(),0);
});
test('gate and deadline are rechecked after live account/permission reads',async()=>{
 let s;s=fixture({getClient:()=>({asServiceRole:{entities:{User:{get:async()=>({id:'OPERATOR',role:'admin'})},StaffMember:{filter:async()=>{s.env.PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED='false';return [{active:true,staff_role:'super_admin'}];}}}}})});
 assert.equal((await (await s.handler(request())).json()).data.authorized,false);
});
test('actual authority entry validates canonical HMAC and rejects replay and path substitution',async()=>{
 const originalClient=globalThis.__testClient,originalSecrets=globalThis.__testSecrets,nonces=[];
 const secret='synthetic-inbound-secret',key='test-inbound';
 globalThis.__testSecrets={PERKSPHERE_GIFT_SOURCE_ADMIN_ENABLED:'true',PERKSPHERE_LINUX_INBOUND_KEY_ID:key,PERKSPHERE_LINUX_INBOUND_HMAC_SECRET:secret};
 globalThis.__testClient={asServiceRole:{entities:{User:{get:async()=>({id:'OPERATOR',role:'admin'})},StaffMember:{filter:async()=>[{active:true,staff_role:'super_admin'}]},TrustedApiNonce:{filter:async q=>nonces.filter(n=>n.key_id===q.key_id&&n.nonce===q.nonce),create:async n=>nonces.push(n)}}}};
 function signed(path='/functions/trustedGiftSourceAuthority'){
  const raw=JSON.stringify({...payload(),expiresAt:new Date(Date.now()+20000).toISOString()}),timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
  const signature=createHmac('sha256',secret).update(['POST',path,timestamp,nonce,createHash('sha256').update(raw).digest('hex')].join('\n')).digest('hex');
  return ()=>request(raw,{'X-PS-Key-ID':key,'X-PS-Timestamp':timestamp,'X-PS-Nonce':nonce,'X-PS-Signature':signature});
 }
 try{
  const good=signed();assert.equal((await (await entry(good())).json()).data.authorized,true);assert.equal((await entry(good())).status,401);
  assert.equal((await entry(signed('/functions/trustedLaunchSource')())).status,401);
 }finally{globalThis.__testClient=originalClient;globalThis.__testSecrets=originalSecrets;}
});
