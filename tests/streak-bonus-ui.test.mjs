import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let active;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const runtime={
 React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
 useState:value=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>h.slots[i]=typeof v==='function'?v(h.slots[i]):v];},
 useRef:value=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:value});},
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,old=h.slots[i];if(!same(old?.deps,deps))h.effects.push(()=>{old?.cleanup?.();h.slots[i]={deps,cleanup:fn()};});},
 base44:{functions:{invoke:(...args)=>active.invoke(...args)}}
};
globalThis.__streakBonus=runtime;
const raw=await readFile(new URL('../src/components/perk/VerifiedStreakBonuses.jsx',import.meta.url),'utf8');
const prefix="const {React,useState,useRef,useEffect,base44}=globalThis.__streakBonus;const Link='Link';";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Bonuses}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function text(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(text).join(' ');return typeof v==='object'?text(v.props?.children):String(v);}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const campaign={account_reference:'account',campaign_reference:'campaign',task_references:['task'],points:10,xp:20,activity_after:'2026-10-01'};
function fixture(claim=async()=>({data:{data:{issued:true}}})){
 const h={userId:'A',slots:[],effects:[],cursor:0,key:undefined,calls:[],refreshes:0};
 h.invoke=(name,body)=>{h.calls.push({name,body});return name==='listVerifiedStreaks'?Promise.resolve({data:{data:[campaign]}}):claim();};
 h.cleanup=()=>h.slots.forEach(s=>s?.cleanup?.());
 h.render=(effects=true)=>{
  active=h;const outer=Bonuses({userId:h.userId,tasks:[{id:'task',name:'Watch'}],refreshWallet:async()=>{h.refreshes++;return h.refresh?.();}});
  if(!outer){h.cleanup();h.slots=[];h.key=undefined;return null;}
  if(h.key!==outer.props.key){h.cleanup();h.slots=[];h.effects=[];h.key=outer.props.key;}
  h.cursor=0;const view=outer.type(outer.props);if(effects)h.effects.splice(0).forEach(fn=>fn());return view;
 };
 h.flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();return h.render();};
 h.button=()=>nodes(h.render()).find(n=>n.type==='button');
 return h;
}
test('campaign listing never automatically claims and repeated clicks send one claim',async()=>{
 const pending=deferred(),h=fixture(()=>pending.promise);h.render();await h.flush();assert.deepEqual(h.calls.map(c=>c.name),['listVerifiedStreaks']);
 const button=h.button(),first=button.props.onClick();await button.props.onClick();assert.equal(h.calls.filter(c=>c.name==='claimVerifiedStreak').length,1);
 pending.resolve({data:{data:{issued:true}}});await first;assert.match(text(h.render()),/Bonus added/);assert.equal(h.refreshes,1);h.cleanup();
});
test('duplicate bonuses refresh the wallet without claiming a fresh award',async()=>{
 const h=fixture(async()=>({data:{data:{issued:false,duplicate:true}}}));h.render();await h.flush();await h.button().props.onClick();
 assert.match(text(h.render()),/already awarded/);assert.doesNotMatch(text(h.render()),/Bonus added/);assert.equal(h.refreshes,1);h.cleanup();
});
test('failed wallet refresh preserves the confirmed bonus receipt',async()=>{
 for(const refresh of [async()=>false,async()=>{throw Error('private');}]){
  const h=fixture();h.refresh=refresh;h.render();await h.flush();await h.button().props.onClick();assert.match(text(h.render()),/Bonus added/);assert.match(text(h.render()),/Refresh your wallet/);assert.doesNotMatch(text(h.render()),/Could not check|private/);h.cleanup();
 }
});
test('member switch hides campaigns and late claim cannot refresh or release new member action',async()=>{
 const a=deferred(),b=deferred();let count=0;const h=fixture(()=>++count===1?a.promise:b.promise);h.render();await h.flush();const old=h.button(),first=old.props.onClick();
 h.userId='B';assert.equal(h.render(false),null);h.render();await h.flush();const second=h.button().props.onClick();
 a.resolve({data:{data:{issued:true}}});await first;assert.equal(h.refreshes,0);assert.equal(h.button().props.disabled,true);await old.props.onClick();assert.equal(count,2);
 b.resolve({data:{data:{issued:false,reason:'five_days_required'}}});await second;assert.match(text(h.render()),/five consecutive/);assert.equal(h.refreshes,0);h.cleanup();
});
test('logout and malformed receipts cannot show or refresh a bonus',async()=>{
 const h=fixture(async()=>({data:{data:{}}}));h.render();await h.flush();await h.button().props.onClick();assert.match(text(h.render()),/Could not check/);assert.equal(h.refreshes,0);
 const old=h.button();h.userId=null;assert.equal(h.render(),null);const count=h.calls.length;await old.props.onClick();assert.equal(h.calls.length,count);h.cleanup();
});
test.after(()=>delete globalThis.__streakBonus);
