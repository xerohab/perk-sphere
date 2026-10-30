import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {pendingConversion,conversionInput,confirmedConversion,definitivePolicyChange} from '../src/lib/xp-conversion-client.js';
let active;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const runtime={
 React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
 useAuth:()=>({user:active.user}),
 useMemberWallet:()=>({wallet:{points_balance:'50',loyalty_xp:'500'},refresh:()=>active.refresh()}),
 formatWalletInteger:value=>String(value),
 useState:value=>{const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;}];},
 useRef:value=>{const h=active,i=h.cursor++;return h.slots[i]??(h.slots[i]={current:value});},
 useCallback:(fn,deps)=>{const h=active,i=h.cursor++;if(!same(h.slots[i]?.deps,deps))h.slots[i]={deps,fn};return h.slots[i].fn;},
 useEffect:(fn,deps)=>{const h=active,i=h.cursor++,old=h.slots[i];if(!same(old?.deps,deps))h.effects.push(()=>{old?.cleanup?.();h.slots[i]={deps,cleanup:fn()};});},
 base44:{functions:{invoke:(...args)=>active.invoke(...args)}},
 pendingConversion,conversionInput,confirmedConversion,definitivePolicyChange
};
globalThis.__walletRecovery=runtime;
const raw=await readFile(new URL('../src/pages/user/Wallet.jsx',import.meta.url),'utf8');
const prefix="const {React,useState,useRef,useCallback,useEffect,useAuth,useMemberWallet,formatWalletInteger,base44,pendingConversion,conversionInput,confirmedConversion,definitivePolicyChange}=globalThis.__walletRecovery;const PageHeader='PageHeader',Button='Button';";
const output=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Wallet}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function text(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(text).join(' ');return typeof v==='object'?text(v.props?.children):String(v);}
const receipt=(request,extra={})=>({data:{data:{duplicate:false,xp_spent:String(request.xp),points_credited:'10',...extra}}});
function fixture(convert){
 const h={user:{id:'A'},slots:[],effects:[],cursor:0,requests:[],policy:{version:1,input_xp:100,output_points:10},memory:new Map(),refresh:async()=>{}};
 globalThis.sessionStorage={getItem:key=>h.memory.get(key)??null,setItem:(key,value)=>h.memory.set(key,value),removeItem:key=>h.memory.delete(key)};
 h.invoke=async(name,body)=>{assert.equal(name,'convertXp');if(body.action==='policy')return {data:{data:h.policy}};h.requests.push(body);return convert(body,h);};
 h.render=()=>{active=h;h.cursor=0;const view=Wallet();h.effects.splice(0).forEach(fn=>fn());return view;};
 h.flush=async()=>{await Promise.resolve();await Promise.resolve();return h.render();};
 h.amount=value=>{const input=nodes(h.render()).find(n=>n.type==='input');assert.ok(input);input.props.onChange({target:{value}});return h.render();};
 h.submit=()=>nodes(h.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 h.destroy=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}
test('a timed-out conversion retains its identity and retry consumes the original receipt',async()=>{
 let attempt=0;const h=fixture(async request=>{if(++attempt===1)throw Error('timeout');return receipt(request,{duplicate:true});});
 h.render();await h.flush();h.amount('100');await h.submit();const saved=JSON.parse(h.memory.get('perksphere-xp-conversion:A'));assert.ok(saved.request_reference);
 await h.submit();assert.equal(h.requests.length,2);assert.equal(h.requests[0].request_reference,h.requests[1].request_reference);assert.equal(h.memory.has('perksphere-xp-conversion:A'),false);assert.match(text(h.render()),/10 points added for 100 XP/);h.destroy();
});
test('policy rejection clears only the rejected identity and waits for explicit confirmation of the new rate',async()=>{
 let attempt=0;const h=fixture(async(request,context)=>{if(++attempt===1){context.policy={version:2,input_xp:200,output_points:10};throw {response:{status:409,data:{error:'conversion_policy_changed',retry_with_new_policy:true}}};}return receipt(request);});
 h.render();await h.flush();h.amount('100');await h.submit();assert.equal(h.requests.length,1);assert.equal(h.memory.has('perksphere-xp-conversion:A'),false);assert.match(text(h.render()),/Review the current rate/);assert.match(text(h.render()),/200\s+XP converts to\s+10\s+points/);
 h.amount('200');await h.submit();assert.notEqual(h.requests[0].request_reference,h.requests[1].request_reference);assert.equal(h.requests[1].policy_version,2);h.destroy();
});
test('a failed balance refresh never relabels a confirmed conversion as an uncertain debit',async()=>{
 const h=fixture(async request=>receipt(request));h.refresh=async()=>{throw Error('offline');};h.render();await h.flush();h.amount('100');await h.submit();
 assert.match(text(h.render()),/Conversion confirmed/);assert.doesNotMatch(text(h.render()),/could not be confirmed/);assert.equal(h.memory.size,0);h.destroy();
});
test('late account-A response cannot display a receipt or release account-B request',async()=>{
 let resolveA,resolveB;const a=new Promise(resolve=>resolveA=resolve),b=new Promise(resolve=>resolveB=resolve);
 const h=fixture((request,context)=>context.user.id==='A'?a:b);h.render();await h.flush();h.amount('100');const first=h.submit();
 h.user={id:'B'};h.render();await h.flush();h.amount('100');const second=h.submit();
 resolveA(receipt(h.requests[0],{points_credited:'999'}));await first;assert.doesNotMatch(text(h.render()),/999/);assert.ok(nodes(h.render()).some(n=>n.type==='Button'&&text(n)==='Processing…'&&n.props.disabled));
 assert.equal(h.memory.has('perksphere-xp-conversion:A'),true);assert.equal(h.memory.has('perksphere-xp-conversion:B'),true);
 resolveB(receipt(h.requests[1]));await second;assert.equal(h.memory.has('perksphere-xp-conversion:B'),false);h.destroy();
});
test('corrupt recovery data remains preserved and blocks new conversion requests',async()=>{
 const h=fixture(async request=>receipt(request));h.memory.set('perksphere-xp-conversion:A','broken');h.render();await h.flush();await h.submit();
 assert.equal(h.requests.length,0);assert.equal(h.memory.get('perksphere-xp-conversion:A'),'broken');assert.match(text(h.render()),/Contact support before starting another conversion/);h.destroy();
});
test.after(()=>{delete globalThis.__walletRecovery;delete globalThis.sessionStorage;});
