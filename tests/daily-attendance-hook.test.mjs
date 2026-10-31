import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let effect,invoke;
globalThis.__attendance={useEffect:fn=>{effect=fn;},base44:{functions:{invoke:(...args)=>invoke(...args)}}};
const raw=await readFile(new URL('../src/hooks/useDailyAttendance.js',import.meta.url),'utf8');
const code='const {useEffect,base44}=globalThis.__attendance;'+raw.replace(/^import .*;\r?\n/gm,'');
const {useDailyAttendance}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const day=()=>new Date().toISOString().slice(0,10);
function fixture(member='A',request=async()=>({data:{enabled:true,user_reference:member,day:day(),points_deducted:0}})){
 const events=new Map(),sent=[],calls=[];
 globalThis.document={hidden:false,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
 globalThis.window={addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key),dispatchEvent:event=>sent.push(event)};
 globalThis.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
 invoke=(name,body)=>{calls.push({name,body});return request();};
 useDailyAttendance(member);const cleanup=effect();
 return {events,sent,calls,cleanup,flush:async()=>{for(let i=0;i<5;i++)await Promise.resolve();}};
}
test('signed-in attendance uses only status and suppresses repeated successful same-day checks',async()=>{
 const h=fixture();await h.flush();assert.deepEqual(h.calls,[{name:'dailyLoginStatus',body:{}}]);await h.events.get('focus')();assert.equal(h.calls.length,1);h.cleanup();assert.equal(h.events.size,0);
});
test('failed attendance retries when focused and only current-member deductions refresh wallets',async()=>{
 let attempt=0;const h=fixture('A',async()=>{if(++attempt===1)throw Error('offline');return {data:{enabled:true,user_reference:'A',day:day(),points_deducted:2}};});
 await h.flush();await h.events.get('focus')();assert.equal(h.calls.length,2);assert.deepEqual(h.sent.map(e=>({type:e.type,detail:e.detail})),[{type:'perksphere-wallet-refresh',detail:{member:'A'}}]);h.cleanup();
 const wrong=fixture('A',async()=>({data:{enabled:true,user_reference:'B',day:day(),points_deducted:99}}));await wrong.flush();assert.equal(wrong.sent.length,0);wrong.cleanup();
});
test('logout and unmounted responses cannot dispatch or continue tracking',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),h=fixture('A',()=>pending);h.cleanup();resolve({data:{enabled:true,user_reference:'A',day:day(),points_deducted:5}});await h.flush();assert.equal(h.sent.length,0);assert.equal(h.events.size,0);
 const off=fixture(null);await off.flush();assert.equal(off.calls.length,0);off.cleanup?.();
});
test.after(()=>{delete globalThis.__attendance;delete globalThis.document;delete globalThis.window;delete globalThis.CustomEvent;});
