import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {connectionDisplayState} from '../src/lib/connection-settings.js';
let active;
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
 loadConnectionSettings:(client,member)=>active.settings(member),connectionDisplayState
};
globalThis.__connectionSession=runtime;
const raw=await readFile(new URL('../src/pages/user/ConnectedServices.jsx',import.meta.url),'utf8');
const prefix="const {React,useAuth,useToast,useSearchParams,useState,useRef,useCallback,useEffect,base44,loadConnectionSettings,connectionDisplayState}=globalThis.__connectionSession;const PageHeader='PageHeader',ServiceCard='ServiceCard',Button='Button';";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:ConnectedServices}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const settings=member=>({connections:[{id:member,user_id:member,service:'x',status:'connected',account_handle:member}],config:{x:{configured:true}},connectionsUnavailable:false,configurationUnavailable:false});
function fixture(invoke=async()=>({data:{ok:true}})){
 const h={user:{id:'A'},slots:[],cursor:0,effects:[],key:undefined,requests:[],toasts:[],search:new URLSearchParams()};
 h.toast=value=>h.toasts.push(value);h.settings=async member=>settings(member);
 h.invoke=(name,body)=>{h.requests.push({name,body});return invoke(name,body);};
 h.cleanup=()=>h.slots.forEach(s=>s?.cleanup?.());
 h.render=(effects=true)=>{
  active=h;const outer=ConnectedServices();
  if(!outer){if(h.key!==undefined){h.cleanup();h.key=undefined;h.slots=[];}return null;}
  if(h.key!==outer.props.key){h.cleanup();h.slots=[];h.key=outer.props.key;}
  h.cursor=0;h.effects=[];const view=outer.type(outer.props);
  if(effects)h.effects.splice(0).forEach(fn=>fn());return view;
 };
 h.flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();return h.render();};
 h.card=()=>nodes(h.render()).find(n=>n.type==='ServiceCard'&&n.props.name==='X (Twitter)');
 return h;
}
test('member switch remounts connections before effects and logout hides all services',async()=>{
 const h=fixture();h.render();await h.flush();assert.equal(h.card().props.connection.account_handle,'A');
 h.user={id:'B'};assert.equal(nodes(h.render(false)).some(n=>n.type==='ServiceCard'),false);h.render();await h.flush();assert.equal(h.card().props.connection.account_handle,'B');
 h.user=null;assert.equal(h.render(),null);h.cleanup();
});
test('saved previous-member connect and disconnect handlers cannot send requests',async()=>{
 const h=fixture();h.render();await h.flush();const old=h.card();h.user={id:'B'};h.render();await h.flush();
 await old.props.onConnect();await old.props.onDisconnect();assert.equal(h.requests.length,0);h.cleanup();
});
test('late old disconnect cannot toast or unlock the new member action',async()=>{
 const a=deferred(),b=deferred();let count=0;const h=fixture(()=>++count===1?a.promise:b.promise);h.render();await h.flush();const first=h.card().props.onDisconnect();
 h.user={id:'B'};h.render();await h.flush();const second=h.card().props.onDisconnect();a.resolve({data:{ok:true}});await first;
 assert.equal(h.toasts.length,0);assert.equal(h.card().props.actionsDisabled,true);
 b.resolve({data:{ok:true}});await second;assert.equal(h.toasts.length,1);h.cleanup();
});
test('late authorization response after logout cannot redirect',async()=>{
 const pending=deferred(),h=fixture(()=>pending.promise);globalThis.window={location:{href:'unchanged'}};
 h.render();await h.flush();const first=h.card().props.onConnect();h.user=null;h.render();pending.resolve({data:{ok:true,authorization_url:'https://example.invalid'}});await first;
 assert.equal(window.location.href,'unchanged');assert.equal(h.toasts.length,0);h.cleanup();delete globalThis.window;
});
test.after(()=>delete globalThis.__connectionSession);
