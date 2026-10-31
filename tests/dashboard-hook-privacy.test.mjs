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
 base44:{},loadDashboardData:(client,member)=>active.invoke(member)
};
globalThis.__dashboardHookFixture=runtime;
const raw=await readFile(new URL('../src/hooks/useDashboardData.js',import.meta.url),'utf8');
const prefix='const {useState,useRef,useCallback,useEffect,base44,loadDashboardData}=globalThis.__dashboardHookFixture;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {useDashboardData}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const response=member=>({data:Object.fromEntries(['levels','activities','rewards','achievements','tasks','taskProgress'].map(k=>[k,[{id:member}]])),failed:[]});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(invoke=async()=>response('A')){
 const h={user:{id:'A'},slots:[],effects:[],cursor:0,calls:[]};
 h.invoke=member=>{h.calls.push(member);return invoke(member);};
 h.render=(effects=true)=>{active=h;h.cursor=0;h.effects=[];const state=useDashboardData(h.user?.id);if(effects)h.effects.splice(0).forEach(fn=>fn());return state;};
 h.flush=async()=>{await Promise.resolve();await Promise.resolve();return h.render();};
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}

test('dashboard hides all previous-member sections before effects',async()=>{
 const h=fixture();h.render();assert.equal((await h.flush()).activities[0].id,'A');
 h.user={id:'B'};const view=h.render(false);for(const key of ['activities','achievements','taskProgress','tasks','levels','rewards'])assert.deepEqual(view[key],[]);
 assert.equal(view.loading,true);h.destroy();
});
test('late old-session data cannot replace the current dashboard',async()=>{
 const a=deferred(),h=fixture(id=>id==='A'?a.promise:response(id));h.render();h.user={id:'B'};h.render();await h.flush();
 a.resolve(response('A'));assert.equal((await h.flush()).activities[0].id,'B');h.destroy();
});
test('logout and obsolete refresh callbacks make no requests',async()=>{
 const h=fixture(id=>response(id));const old=h.render().loadData;await h.flush();h.user=null;assert.deepEqual(h.render().activities,[]);
 const count=h.calls.length;assert.equal(await old(),false);assert.equal(h.calls.length,count);h.destroy();
});
test('A B A switching does not restore an old A session',async()=>{
 const old=deferred(),fresh=deferred();let count=0;const h=fixture(()=>++count===1?old.promise:fresh.promise);
 h.render();h.user={id:'B'};h.render(false);h.user={id:'A'};h.render();old.resolve(response('OLD'));assert.deepEqual((await h.flush()).activities,[]);
 fresh.resolve(response('NEW'));assert.equal((await h.flush()).activities[0].id,'NEW');h.destroy();
});
test('latest same-member refresh wins and errors expose no diagnostics',async()=>{
 const first=deferred(),second=deferred();let count=0;const h=fixture(()=>++count===1?first.promise:second.promise);
 h.render();const refresh=h.render().loadData();second.resolve(response('NEW'));await refresh;first.resolve(response('OLD'));assert.equal((await h.flush()).activities[0].id,'NEW');h.destroy();
 const fail=fixture(()=>{throw Error('private provider diagnostics');});fail.render();const view=await fail.flush();assert.deepEqual(view.sectionErrors,['dashboard']);assert.equal(view.loading,false);assert.ok(!JSON.stringify(view).includes('private'));fail.destroy();
});
test('unmounted refreshes are inert and public task filters are preserved',async()=>{
 const data=response('A');data.data.tasks=[{id:'visible'},{id:'off',active:false},{id:'archived',archived:true},{id:'hidden',publicly_visible:false}];data.data.rewards=[{id:'on'},{id:'off',active:false}];
 const h=fixture(()=>data);h.render();const view=await h.flush();assert.deepEqual(view.tasks.map(t=>t.id),['visible']);assert.deepEqual(view.rewards.map(r=>r.id),['on']);
 h.destroy();const count=h.calls.length;assert.equal(await view.loadData(),false);assert.equal(h.calls.length,count);
});
test.after(()=>delete globalThis.__dashboardHookFixture);
