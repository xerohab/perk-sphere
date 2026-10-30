import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../base44/functions/oauthConfig/entry.ts';
const request=()=>new Request('https://test.invalid',{method:'POST',body:'{}'});
test('provider status requires authenticated POST and private responses',async()=>{
 globalThis.__testClient={auth:{me:async()=>null}};
 let response=await config(request());assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 response=await config(new Request('https://test.invalid'));assert.equal(response.status,405);
});
test('configuration status exposes booleans without credentials or redirect URIs',async()=>{
 globalThis.__testClient={auth:{me:async()=>({id:'MEMBER'})}};
 globalThis.__testSecrets={X_CLIENT_ID:'synthetic-id',X_CLIENT_SECRET:'synthetic-secret',X_REDIRECT_URI:'https://example.invalid/callback'};
 const response=await config(request());assert.equal(response.status,200);const raw=await response.text();assert.doesNotMatch(raw,/synthetic|example.invalid/);const body=JSON.parse(raw);assert.equal(body.providers.x.configured,true);assert.equal(body.providers.youtube.configured,false);
});
test.after(()=>{delete globalThis.__testClient;delete globalThis.__testSecrets;});
