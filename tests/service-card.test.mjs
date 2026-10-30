import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
globalThis.__serviceCard={React:{createElement:(type,props,...children)=>({type,props:{...props,children}})}};
const raw=await readFile(new URL('../src/components/perk/ServiceCard.jsx',import.meta.url),'utf8');
const code="const {React}=globalThis.__serviceCard;const Button='Button',Check='Check',Loader2='Loader2';"+raw.replace(/^import .*;\r?\n/gm,'');
const {default:Card}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
function nodes(v){if(!v||typeof v!=='object')return [];if(Array.isArray(v))return v.flatMap(nodes);return [v,...nodes(v.props?.children)];}
function text(v){if(v==null||typeof v==='boolean')return '';if(Array.isArray(v))return v.map(text).join(' ');return typeof v==='object'?text(v.props?.children):String(v);}
test('existing account can be disconnected when new connections or configuration checks are unavailable',()=>{
 for(const configurationUnavailable of [false,true]){
  let disconnected=0;const card=Card({name:'X',configured:false,isConnected:true,canDisconnect:true,configurationUnavailable,onDisconnect:()=>disconnected++});
  const buttons=nodes(card).filter(n=>n.type==='Button');assert.equal(buttons.length,1);assert.equal(text(buttons[0]),'Disconnect');buttons[0].props.onClick();assert.equal(disconnected,1);
 }
});
test('expired connections offer reconnect and local disconnect without claiming a fresh reward',()=>{
 const card=Card({name:'X',configured:true,isConnected:false,canDisconnect:true,needsReconnect:true});
 const buttons=nodes(card).filter(n=>n.type==='Button').map(text);assert.deepEqual(buttons,['Reconnect','Disconnect']);assert.match(text(card),/does not grant another once-only linking reward/);
});
test('shared action lock disables both reconnect and disconnect controls',()=>{
 const card=Card({name:'X',configured:true,isConnected:false,canDisconnect:true,needsReconnect:true,actionsDisabled:true});
 assert.ok(nodes(card).filter(n=>n.type==='Button').every(n=>n.props.disabled));
});
test('ambiguous connection records offer cleanup and review rather than an ineffective reconnect',()=>{
 const card=Card({name:'X',configured:true,isConnected:false,canDisconnect:true,needsReconnect:true,requiresReview:true});
 assert.deepEqual(nodes(card).filter(n=>n.type==='Button').map(text),['Disconnect']);assert.match(text(card),/contact support before reconnecting/);
});
test.after(()=>delete globalThis.__serviceCard);
