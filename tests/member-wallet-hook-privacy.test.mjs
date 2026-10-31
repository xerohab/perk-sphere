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
globalThis.__walletHookFixture=runtime;
const raw=await readFile(new URL('../src/hooks/useMemberWallet.js',import.meta.url),'utf8');
const prefix='const {useAuth,useState,useRef,useCallback,useEffect,base44}=globalThis.__walletHookFixture;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {useMemberWallet}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const response=(member,balance='10')=>({data:{ok:true,data:{user_reference:member,source:'linux',points_balance:balance,loyalty_xp:'5',points:[],xp:[]}}});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(invoke=async()=>response('A')){
 const h={user:{id:'A'},slots:[],effects:[],cursor:0,calls:[]};
 h.invoke=(name,body)=>{h.calls.push([name,body]);return invoke(h.user?.id);};
 h.render=(effects=true)=>{active=h;h.cursor=0;h.effects=[];const state=useMemberWallet();if(effects)h.effects.splice(0).forEach(fn=>fn());return state;};
 h.flush=async()=>{await Promise.resolve();await Promise.resolve();return h.render();};
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}
test('account switching hides a completed wallet before effects run',async()=>{
 const h=fixture();h.render();assert.equal((await h.flush()).wallet.points_balance,'10');
 h.user={id:'B'};const view=h.render(false);assert.equal(view.wallet,null);assert.equal(view.error,'');assert.equal(view.loading,true);h.destroy();
});
test('late account-A responses cannot overwrite a loaded account-B wallet',async()=>{
 const a=deferred(),b=deferred(),h=fixture(id=>id==='A'?a.promise:b.promise);
 h.render();h.user={id:'B'};h.render();b.resolve(response('B','20'));await h.flush();a.resolve(response('A','999'));const view=await h.flush();
 assert.equal(view.wallet.user_reference,'B');assert.equal(view.wallet.points_balance,'20');h.destroy();
});
test('a saved refresh from a previous member cannot request or clear the current wallet',async()=>{
 const h=fixture(async id=>response(id));const old=h.render().refresh;await h.flush();h.user={id:'B'};h.render();await h.flush();const calls=h.calls.length;
 assert.equal(await old(),false);assert.equal(h.calls.length,calls);assert.equal(h.render().wallet.user_reference,'B');h.destroy();
});
test('server identity mismatch fails closed and does not expose provider diagnostics',async()=>{
 const h=fixture(async()=>response('B','999'));h.render();const view=await h.flush();
 assert.equal(view.wallet,null);assert.match(view.error,/temporarily unavailable/);assert.equal(view.loading,false);h.destroy();
});
test('logout makes no wallet request and hides previous state immediately',async()=>{
 const h=fixture();h.render();await h.flush();const before=h.calls.length;h.user=null;
 const immediate=h.render(false);assert.equal(immediate.wallet,null);assert.equal(immediate.loading,false);h.render();await h.flush();assert.equal(h.calls.length,before);h.destroy();
});
test('A to B to A does not accept an earlier A-session response',async()=>{
 const first=deferred(),newer=deferred();let calls=0;const h=fixture(()=>++calls===1?first.promise:newer.promise);
 h.render();h.user={id:'B'};h.render(false);h.user={id:'A'};h.render();first.resolve(response('A','999'));await h.flush();assert.equal(h.render().wallet,null);
 newer.resolve(response('A','30'));assert.equal((await h.flush()).wallet.points_balance,'30');h.destroy();
});
test('unmounted refresh callbacks cannot make a new request',async()=>{const h=fixture();const refresh=h.render().refresh;await h.flush();h.destroy();const calls=h.calls.length;assert.equal(await refresh(),false);assert.equal(h.calls.length,calls);});
test.after(()=>{delete globalThis.__walletHookFixture;});
