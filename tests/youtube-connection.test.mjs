import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeUserInfo, getProviderSecrets, ALLOWED_PROVIDERS } from '../base44/shared/oauth.ts';
test('YouTube has a distinct read-only OAuth configuration', () => {
  assert.ok(ALLOWED_PROVIDERS.includes('youtube'));
  const values={YOUTUBE_CLIENT_ID:'id',YOUTUBE_CLIENT_SECRET:'secret',YOUTUBE_REDIRECT_URI:'https://example.com/callback?provider=youtube'};
  const config=getProviderSecrets({get:k=>values[k]},'youtube');
  assert.equal(config.scopes,'https://www.googleapis.com/auth/youtube.readonly');
  assert.equal(getProviderSecrets({get:()=>null},'youtube'),null);
});
test('YouTube derives channel identity through authenticated mine lookup',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(url,opts)=>{
   assert.equal(new URL(url).searchParams.get('mine'),'true');
   assert.equal(opts.headers.Authorization,'Bearer test-token');
   return Response.json({items:[{id:'UCabcdefghijklmnopqrstuv',snippet:{title:'My Channel',customUrl:'@channel'}}]});
  };
  const identity=await getYouTubeUserInfo('test-token');
  assert.equal(identity.provider_user_id,'UCabcdefghijklmnopqrstuv');
  assert.equal(identity.provider_email,null);
 }finally{globalThis.fetch=original;}
});
test('YouTube rejects absent, ambiguous and malformed identities and redacts provider errors',async()=>{
 const original=globalThis.fetch;
 try {
  for(const body of [{items:[]},{items:[{},{}]},{items:[{id:'fake'}]}]){
   globalThis.fetch=async()=>Response.json(body);
   await assert.rejects(getYouTubeUserInfo('test-token'));
  }
  globalThis.fetch=async()=>Response.json({error:{message:'sensitive-provider-text'}},{status:403});
  await assert.rejects(getYouTubeUserInfo('test-token'),error=>!error.message.includes('sensitive-provider-text'));
 }finally{globalThis.fetch=original;}
});
