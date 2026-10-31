import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let active;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const runtime={
 React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
 useAuth:()=>({user:active.user}),
 useToast:()=>({toast:active.toast}),useSearchParams:()=>[active.search],
 useState:value=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];},
 useRef:value=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:value});},
 useCallback:(fn,deps)=>{const h=active,i=h.cursor++;if(!same(h.slots[i]?.deps,deps))h.slots[i]={deps,fn};return h.slots[i].fn;},
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,old=h.slots[i];if(!same(old?.deps,deps))h.effects.push(()=>{old?.cleanup?.();h.slots[i]={deps,cleanup:fn()};});},
 base44:{functions:{invoke:(...args)=>active.invoke(...args)}},
};
globalThis.__gameSession=runtime;
const raw=await readFile(new URL('../src/pages/user/Games.jsx',import.meta.url),'utf8');
const prefix="const {React,useAuth,useToast,useSearchParams,useState,useRef,useCallback,useEffect,base44}=globalThis.__gameSession;const PageHeader='PageHeader',CardLadder='CardLadder',SponsorSlot='SponsorSlot',Button='Button';const NATIVE_GAMES=[{id:'number-memory',instruction:'Remember the code'}];";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Games}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const settings=member=>({connections:[{id:member,user_id:member,service:'x',status:'connected',account_handle:member}],config:{x:{configured:true}},connectionsUnavailable:false,configurationUnavailable:false});
function fixture(invoke=async()=>({data:{data:{session_uuid:'session-A',status:'active',eligible_seconds:0,required_seconds:60,points:2,xp:5,challenge:'123456'}}})){
 const h={user:{id:'A'},slots:[],cursor:0,effects:[],key:undefined,requests:[],toasts:[],search:new URLSearchParams()};
 h.toast=value=>h.toasts.push(value);h.settings=async member=>settings(member);
 h.invoke=(name,body)=>{if(name==='getGameCatalog')return Promise.resolve({data:{data:[{game_reference:'number-memory',title:'Number Memory',points:2,xp:5,required_seconds:60}]}});h.requests.push({name,body});return invoke(name,body);};
 h.cleanup=()=>h.slots.forEach(s=>s?.cleanup?.());
 h.render=(effects=true)=>{
  active=h;const outer=Games();
  if(!outer){if(h.key!==undefined){h.cleanup();h.key=undefined;h.slots=[];}return null;}
  if(h.key!==outer.props.key){h.cleanup();h.slots=[];h.key=outer.props.key;}
  h.cursor=0;h.effects=[];const view=outer.type(outer.props);
  if(effects)h.effects.splice(0).forEach(fn=>fn());return view;
 };
 h.flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();return h.render();};
 h.start=()=>nodes(h.render()).find(n=>n.type==='Button'&&n.props.children.includes('Start / Resume'));
 return h;
}

test('account switching hides an active game immediately and saved start callbacks are inert',async()=>{
 const h=fixture();h.render();await h.flush();await h.start().props.onClick();const old=h.start();
 assert.ok(nodes(h.render()).some(n=>n.type==='progress'));h.user={id:'B'};
 assert.equal(nodes(h.render(false)).some(n=>n.type==='progress'),false);h.render();await h.flush();const count=h.requests.length;
 await old.props.onClick();assert.equal(h.requests.length,count);h.cleanup();
});
test('late previous-member game response cannot display its challenge or release a new request',async()=>{
 const a=deferred(),b=deferred();let count=0;const h=fixture(()=>++count===1?a.promise:b.promise);
 h.render();await h.flush();const first=h.start().props.onClick();h.user={id:'B'};h.render();await h.flush();const second=h.start().props.onClick();
 a.resolve({data:{data:{status:'active',challenge:'999999',session_uuid:'OLD'}}});await first;assert.equal(h.start().props.disabled,true);
 assert.ok(!JSON.stringify(h.render()).includes('999999'));b.resolve({data:{data:{status:'active',challenge:'123456',session_uuid:'NEW',eligible_seconds:0,required_seconds:60,points:2}}});await second;
 assert.equal(h.start().props.disabled,false);h.cleanup();
});
test('repeated game starts send once and logout removes session controls',async()=>{
 const pending=deferred(),h=fixture(()=>pending.promise);h.render();await h.flush();const button=h.start();const first=button.props.onClick();await button.props.onClick();assert.equal(h.requests.length,1);
 h.user=null;h.render();pending.resolve({data:{data:{status:'awarded',points:999}}});await first;assert.ok(!JSON.stringify(h.render()).includes('Reward credited'));h.cleanup();
});
test.after(()=>{delete globalThis.__gameSession;delete globalThis.document;});
