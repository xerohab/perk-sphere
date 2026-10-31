import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let active;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const runtime={
 useAuth:()=>({user:active.user}),
 useState:value=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];},
 useRef:value=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:value});},
 useCallback:(fn,deps)=>{const h=active,i=h.cursor++;if(!same(h.slots[i]?.deps,deps))h.slots[i]={deps,fn};return h.slots[i].fn;},
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,old=h.slots[i];if(!same(old?.deps,deps))h.effects.push(()=>{old?.cleanup?.();h.slots[i]={deps,cleanup:fn()};});},
 base44:{functions:{invoke:(...args)=>active.invoke(...args)}}
};
globalThis.__partnerHookFixture=runtime;
const raw=await readFile(new URL('../src/hooks/usePartnerAccounts.js',import.meta.url),'utf8');
const prefix='const {useAuth,useState,useRef,useCallback,useEffect,base44}=globalThis.__partnerHookFixture;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {usePartnerAccounts}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const response=(member,action)=>({data:{ok:true,user_reference:member,...(action==='listPartners'?{partners:[{id:member,name:member}]}:{links:[],connected:[{id:member}],verification:{}})}});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(invoke=async(id,body)=>response(id,body.action)){
 const h={user:{id:'A'},slots:[],effects:[],cursor:0,calls:[],toasts:[]};
 h.invoke=(name,body)=>{h.calls.push([name,body]);return invoke(h.user?.id,body);};
 h.render=(effects=true)=>{active=h;h.cursor=0;h.effects=[];const state=usePartnerAccounts((...args)=>h.toasts.push(args),{writeClipboard:async()=>{}});if(effects)h.effects.splice(0).forEach(fn=>fn());return state;};
 h.flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();return h.render();};
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}

test('partner data hides immediately on member switch and logout',async()=>{
 const h=fixture();h.render();assert.equal((await h.flush()).connected[0].id,'A');
 h.user={id:'B'};assert.deepEqual(h.render(false).connected,[]);h.render();assert.equal((await h.flush()).connected[0].id,'B');
 const calls=h.calls.length;h.user=null;assert.deepEqual(h.render().connected,[]);await h.flush();assert.equal(h.calls.length,calls);h.destroy();
});
test('late previous-member results cannot overwrite current connections',async()=>{
 const a=deferred(),h=fixture((id,body)=>id==='A'?a.promise:response(id,body.action));
 h.render();h.user={id:'B'};h.render();await h.flush();a.resolve(response('A','listLinks'));assert.equal((await h.flush()).connected[0].id,'B');h.destroy();
});
test('identity mismatch and missing server identity fail closed',async()=>{
 for(const member of ['B',undefined]){const h=fixture((id,body)=>response(member,body.action));h.render();const view=await h.flush();assert.equal(view.loadError,true);assert.deepEqual(view.connected,[]);h.destroy();}
});
test('repeated connect clicks send one challenge and stale completion opens no dialog',async()=>{
 const pending=deferred();const h=fixture((id,body)=>body.action==='createChallenge'?pending.promise:response(id,body.action));
 h.render();await h.flush();const view=h.render();const first=view.startLink({id:'partner'});await view.startLink({id:'partner'});
 assert.equal(h.calls.filter(([,b])=>b.action==='createChallenge').length,1);
 h.user={id:'B'};h.render();pending.resolve({data:{ok:true,user_reference:'A',challenge_token:'a'.repeat(43),expires_at:new Date(Date.now()+60000).toISOString()}});
 await first;assert.equal((await h.flush()).challengeDialog,null);assert.equal(h.toasts.length,0);h.destroy();
});
test('unsuccessful unlink never reports success or removes saved view',async()=>{
 const h=fixture((id,body)=>body.action==='unlink'?{data:{ok:false}}:response(id,body.action));h.render();await h.flush();await h.render().unlink('A');
 assert.equal(h.toasts[0][0].variant,'destructive');assert.equal(h.render().connected[0].id,'A');h.destroy();
});
test.after(()=>{delete globalThis.__partnerHookFixture;});
