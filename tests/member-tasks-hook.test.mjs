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
 base44:{entities:{Task:{list:()=>active.list()},TaskProgress:{filter:query=>active.progress(query)}},functions:{invoke:(name,body)=>active.invoke(name,body)}}
};
globalThis.__taskHookFixture=runtime;
const raw=await readFile(new URL('../src/hooks/useMemberTasks.js',import.meta.url),'utf8');
const prefix='const {useState,useRef,useCallback,useEffect,base44}=globalThis.__taskHookFixture;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {useMemberTasks}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const task={id:'task',name:'Task'};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(invoke=async()=>({data:{ok:true,points_issued:2,xp_issued:5}})){
 const h={user:{id:'A'},slots:[],effects:[],cursor:0,calls:[],toasts:[],refreshes:0};
 h.invoke=(name,body)=>{h.calls.push({name,body,member:h.user?.id});return invoke(name,body,h);};h.list=async()=>[task];h.progress=async query=>[{id:query.user_id,user_id:query.user_id,task_id:'task'}];
 h.render=(effects=true)=>{active=h;h.cursor=0;h.effects=[];const state=useMemberTasks(h.user?.id,value=>h.toasts.push(value),async()=>{h.refreshes++;});if(effects)h.effects.splice(0).forEach(fn=>fn());return state;};
 h.flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();return h.render();};
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}


test('member tasks hide previous progress immediately and ignore late old loads',async()=>{
 const a=deferred(),h=fixture();h.progress=query=>query.user_id==='A'?a.promise:Promise.resolve([{id:'B'}]);
 h.render();h.user={id:'B'};assert.deepEqual(h.render(false).progress,[]);h.render();await h.flush();a.resolve([{id:'A'}]);assert.equal((await h.flush()).progress[0].id,'B');h.destroy();
});
test('logout and obsolete start or refresh callbacks make no requests',async()=>{
 const h=fixture();const old=h.render();await h.flush();h.user=null;assert.deepEqual(h.render().progress,[]);const count=h.calls.length;await old.handleStart(task);assert.equal(await old.load(),false);assert.equal(h.calls.length,count);h.destroy();
});
test('double start clicks create one request and only confirmed owned progress succeeds',async()=>{
 const pending=deferred(),h=fixture(()=>pending.promise);h.render();await h.flush();const view=h.render();const first=view.handleStart(task);await view.handleStart(task);assert.equal(h.calls.length,1);
 pending.resolve({data:{ok:true,progress:{task_id:'task',user_id:'A',status:'in_progress'}}});await first;assert.equal(h.toasts[0].title,'Task started');h.destroy();
 for(const data of [{ok:false},{ok:true},{ok:true,progress:{task_id:'task',user_id:'B',status:'in_progress'}}]){const f=fixture(async()=>({data}));f.render();await f.flush();await f.render().handleStart(task);assert.equal(f.toasts[0].variant,'destructive');f.destroy();}
});
test('a late start cannot toast, reload or unlock the new member action',async()=>{
 const a=deferred(),b=deferred(),h=fixture((name,body,ctx)=>ctx.user.id==='A'?a.promise:b.promise);h.render();await h.flush();const first=h.render().handleStart(task);
 h.user={id:'B'};h.render();await h.flush();const second=h.render().handleComplete(task);a.resolve({data:{ok:true,progress:{task_id:'task',user_id:'A',status:'in_progress'}}});await first;
 assert.equal(h.toasts.length,0);assert.equal(h.render().actionTaskId,'task');b.resolve({data:{ok:true,points_issued:2,xp_issued:5}});await second;assert.equal(h.toasts.length,1);assert.equal(h.refreshes,1);h.destroy();
});
test('HTTP success without a valid completion receipt never claims an award',async()=>{
 for(const data of [{},{ok:false},{ok:true},{ok:true,points_issued:-1,xp_issued:5},{ok:true,points_issued:'2',xp_issued:5}]){const h=fixture(async()=>({data}));h.render();await h.flush();await h.render().handleComplete(task);assert.equal(h.toasts[0].variant,'destructive');assert.equal(h.refreshes,0);h.destroy();}
});
test('confirmed completion remains confirmed when task refresh fails',async()=>{
 const h=fixture();h.render();await h.flush();h.list=async()=>{throw Error('private diagnostic');};await h.render().handleComplete(task);
 assert.equal(h.toasts[0].title,'Task completed');assert.equal(h.toasts[1].title,'Completion confirmed');assert.ok(!h.toasts.some(x=>x.variant==='destructive'));assert.ok(!JSON.stringify(h.toasts).includes('private'));h.destroy();
});
test('duplicate completion refreshes without claiming new points',async()=>{
 const h=fixture(async()=>({data:{ok:true,already_completed:true}}));h.render();await h.flush();await h.render().handleComplete(task);assert.equal(h.toasts[0].title,'Already completed');assert.equal(h.toasts.length,1);h.destroy();
});
test('unmount and A B A invalidate pending completions',async()=>{
 const pending=deferred(),h=fixture(()=>pending.promise);h.render();await h.flush();const first=h.render().handleComplete(task);h.user={id:'B'};h.render(false);h.user={id:'A'};h.render();pending.resolve({data:{ok:true,points_issued:999,xp_issued:999}});await first;assert.equal(h.toasts.length,0);h.destroy();
 const count=h.calls.length;await h.render(false).handleComplete(task);assert.equal(h.calls.length,count);
});
test.after(()=>delete globalThis.__taskHookFixture);
