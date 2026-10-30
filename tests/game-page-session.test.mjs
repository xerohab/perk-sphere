import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const raw=await readFile(new URL('../src/pages/user/Games.jsx',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
let active;
const runtime={
 React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
 useAuth:()=>({user:active.user}),
 useState:value=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];},
 useRef:value=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:value});},
 useCallback:(fn,deps)=>{const h=active,i=h.cursor++;if(!same(h.slots[i]?.deps,deps))h.slots[i]={deps,fn};return h.slots[i].fn;},
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,old=h.slots[i];if(!same(old?.deps,deps)){h.effects.push(()=>{old?.cleanup?.();h.slots[i]={deps,cleanup:fn()};});}},
 base44:{functions:{invoke:(...args)=>active.invoke(...args)}},
 NATIVE_GAMES:[{id:'quick-maths',instruction:'Solve the sum.'}]
};
globalThis.__gamePage=runtime;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
const prefix="const {React,useState,useRef,useCallback,useEffect,useAuth,base44,NATIVE_GAMES}=globalThis.__gamePage;const PageHeader='PageHeader',Button='Button';";
const compiled=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Games}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function text(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(text).join(' ');return typeof v==='object'?text(v.props?.children):String(v);}
const catalog={data:{data:[{game_reference:'quick-maths',title:'Quick Maths',points:2,xp:5,required_seconds:60}]}};
const awarded={data:{data:{status:'awarded',session_uuid:'PRIVATE-A',points:2,xp:5,eligible_seconds:60,required_seconds:60}}};
function harness(invoke){
 const h={user:{id:'A'},invoke,slots:[],effects:[],cursor:0};
 h.render=(effects=true)=>{active=h;h.cursor=0;const view=Games();if(effects){const pending=h.effects.splice(0);pending.forEach(fn=>fn());}return view;};
 h.flush=async()=>{await Promise.resolve();await Promise.resolve();return h.render();};
 h.start=view=>nodes(view).find(n=>n.type==='Button'&&text(n)==='Start / Resume').props.onClick();
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}
test('late award cannot appear for a different member or release their active request',async()=>{
 const old=deferred(),current=deferred();let plays=0;
 const h=harness(name=>name==='getGameCatalog'?Promise.resolve(catalog):(++plays===1?old.promise:current.promise));
 h.render();let view=await h.flush();const first=h.start(view);h.user={id:'B'};h.render();view=await h.flush();const second=h.start(view);
 old.resolve(awarded);await first;view=h.render();assert.doesNotMatch(text(view),/Reward credited/);assert.equal(nodes(view).find(n=>n.type==='Button'&&text(n)==='Start / Resume').props.disabled,true);
 current.resolve(awarded);await second;view=h.render();assert.match(text(view),/Reward credited: 2 points and 5 XP/);h.destroy();
});
test('late rejection after logout cannot display a previous member error',async()=>{
 const pending=deferred();const h=harness(name=>name==='getGameCatalog'?Promise.resolve(catalog):pending.promise);
 h.render();const view=await h.flush();const start=h.start(view);h.user=null;h.render();pending.reject(Error('expired'));await start;assert.doesNotMatch(text(h.render()),/round has expired|Reward credited/);h.destroy();
});
test('completed session is hidden on account change before effects run',async()=>{
 const h=harness(name=>Promise.resolve(name==='getGameCatalog'?catalog:awarded));
 h.render();let view=await h.flush();await h.start(view);assert.match(text(h.render()),/Reward credited/);
 h.user={id:'B'};assert.doesNotMatch(text(h.render(false)),/Reward credited|60 \/ 60/);h.render();await h.flush();h.destroy();
});
test.after(()=>{delete globalThis.__gamePage;delete globalThis.document;});
