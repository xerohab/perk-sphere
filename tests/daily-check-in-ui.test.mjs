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
globalThis.__dailyCheckIn=runtime;
const raw=await readFile(new URL('../src/components/perk/DailyCheckIn.jsx',import.meta.url),'utf8');
const code="const {React,useState,useRef,useEffect,base44}=globalThis.__dailyCheckIn;const Button='Button';"+raw.replace(/^import .*;\r?\n/gm,'');
const {default:CheckIn,isTodayCheckIn}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function text(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(text).join(' ');return typeof v==='object'?text(v.props?.children):String(v);}
function fixture(claim=async()=>({data:{data:{points:1,day:'2026-10-30',duplicate:false}}})){
 const h={userId:'A',now:Date.parse('2026-10-30T12:00:00Z'),slots:[],effects:[],cursor:0,calls:[],refreshes:0};
 h.invoke=async(name,body)=>{h.calls.push({name,body});return name==='dailyLoginStatus'?{data:{enabled:true}}:claim();};
 h.render=()=>{active=h;h.cursor=0;const view=CheckIn({userId:h.userId,now:h.now,refreshWallet:async()=>h.refreshes++});h.effects.splice(0).forEach(fn=>fn());return view;};
 h.flush=async()=>{await Promise.resolve();await Promise.resolve();return h.render();};h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());return h;
}
test('opening the dashboard checks availability but never automatically awards the daily point',async()=>{
 const h=fixture();h.render();const view=await h.flush();assert.deepEqual(h.calls.map(c=>c.name),['dailyLoginStatus']);assert.ok(nodes(view).some(n=>n.type==='Button'));h.destroy();
});
test('concurrent clicks submit one authenticated claim and show its confirmed receipt',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const h=fixture(()=>pending);h.render();let view=await h.flush();const button=nodes(view).find(n=>n.type==='Button');
 const first=button.props.onClick(),second=button.props.onClick();assert.equal(h.calls.filter(c=>c.name==='claimDailyLogin').length,1);
 resolve({data:{data:{points:1,day:'2026-10-30',duplicate:false}}});await Promise.all([first,second]);view=h.render();assert.match(text(view),/1 point added for today/);assert.equal(h.refreshes,1);assert.equal(nodes(view).filter(n=>n.type==='Button').length,0);h.destroy();
});
test('UTC rollover and member identity determine whether a daily receipt is current',()=>{
 const receipt={member:'A',day:'2026-10-30'};assert.equal(isTodayCheckIn(receipt,'A',Date.parse('2026-10-30T23:59:59Z')),true);assert.equal(isTodayCheckIn(receipt,'A',Date.parse('2026-10-31T00:00:00Z')),false);assert.equal(isTodayCheckIn(receipt,'B',Date.parse('2026-10-30T12:00:00Z')),false);
});
test('late claim response cannot publish another member receipt after account change',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),h=fixture(()=>pending);h.render();let view=await h.flush();const claim=nodes(view).find(n=>n.type==='Button').props.onClick();
 h.userId='B';h.render();await h.flush();resolve({data:{data:{points:1,day:'2026-10-30',duplicate:false}}});await claim;assert.doesNotMatch(text(h.render()),/1 point added for today/);assert.equal(h.refreshes,0);h.destroy();
});
test.after(()=>delete globalThis.__dailyCheckIn);
