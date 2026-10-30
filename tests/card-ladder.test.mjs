import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
globalThis.__cards={React:{createElement:(type,props,...children)=>({type,props:{...props,children}})}};
const raw=await readFile(new URL('../src/components/perk/CardLadder.jsx',import.meta.url),'utf8');
const code="const {React}=globalThis.__cards;const Button='Button';"+raw.replace(/^import .*;\r?\n/gm,'');
const {default:Cards,pickCard}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
test('cards accept only unique choices from the server challenge',()=>{
 assert.equal(pickCard('019753','','0'),'0');assert.equal(pickCard('019753','0','0'),'0');assert.equal(pickCard('019753','','2'),'');assert.equal(pickCard('001753','','0'),'');
});
test('sixth interactive choice submits the selected order exactly once',()=>{
 let submitted=[],changed=[];const view=Cards({challenge:'019753',selected:'13579',onChange:v=>changed.push(v),onSubmit:v=>submitted.push(v)});
 const button=nodes(view).find(n=>n.type==='button'&&n.props['aria-label']==='10 ♠');assert.ok(button);button.props.onClick();assert.deepEqual(changed,['135790']);assert.deepEqual(submitted,['135790']);
 assert.equal(nodes(view).filter(n=>n.type==='button').length,6);
});
test('pending round locks card input and malformed challenges offer recovery',()=>{
 let calls=0;const view=Cards({challenge:'019753',disabled:true,onChange:()=>calls++,onSubmit:()=>calls++});
 for(const button of nodes(view).filter(n=>n.type==='button')){assert.equal(button.props.disabled,true);button.props.onClick();}
 assert.equal(calls,0);assert.ok(nodes(Cards({challenge:'bad'})).some(n=>n.props?.role==='alert'));
});
test.after(()=>delete globalThis.__cards);
