import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {giftMemberCheckoutRequest,projectGiftMemberCheckoutResult} from '../base44/shared/giftMemberCheckoutContract.ts';
let user,invoke;
globalThis.__confirmationUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useAuth:()=>({user}),base44:{functions:{invoke:(...a)=>invoke(...a)}},giftMemberCheckoutRequest,projectGiftMemberCheckoutResult};
const raw=await readFile(new URL('../src/components/perk/GiftMemberConfirmation.jsx',import.meta.url),'utf8');
const prefix='const {React,useEffect,useRef,useState,useAuth,base44,giftMemberCheckoutRequest,projectGiftMemberCheckoutResult}=globalThis.__confirmationUi;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Component}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const props={offerReference:'OFFER',fields:[{key:'email',value:'test@example.invalid'}]},absent={found:false,version:0,approved:false,country:null,region:null,source:'member_confirmation',independentlyVerified:false};
async function fixture(fn=async()=>({data:{data:absent}})){user={id:'owner',role:'user'};const calls=[];invoke=(...a)=>{calls.push(a);return fn(...a);};let view;await act(async()=>{view=Renderer.create(React.createElement(Component,props));});return {view,calls,close:async()=>{await act(async()=>view.unmount());}};}
const click=async f=>act(async()=>f.view.root.findByType('button').props.onClick());
test('confirmation form makes no automatic requests and labels self-declared details',async()=>{const f=await fixture();try{assert.equal(f.calls.length,0);assert.match(JSON.stringify(f.view.toJSON()),/not been independently verified/);await click(f);assert.equal(f.calls[0][1].operation,'read');assert.equal(f.view.root.findAllByType('input').length,3);}finally{await f.close();}});
test('uncertain save locks edits and retries exact request before reporting confirmation',async()=>{let n=0;const f=await fixture(async()=>{n++;if(n===1)return {data:{data:absent}};if(n===2)throw Error('PRIVATE');return {data:{data:{version:1,approved:true,duplicate:true,source:'member_confirmation',independentlyVerified:false}}};});try{await click(f);await act(async()=>{f.view.root.findAllByType('input')[0].props.onChange({target:{value:'GB'}});f.view.root.findAllByType('input')[2].props.onChange({target:{checked:true}});});await click(f);assert.ok(f.view.root.findAllByType('input').every(i=>i.props.disabled));assert.doesNotMatch(JSON.stringify(f.view.toJSON()),/PRIVATE/);await click(f);assert.deepEqual(f.calls[1][1],f.calls[2][1]);assert.match(JSON.stringify(f.view.toJSON()),/self-declared details are saved/);}finally{await f.close();}});
test('member changes suppress late reads and stale callbacks',async()=>{let resolve;const f=await fixture(()=>new Promise(r=>resolve=r));try{const old=f.view.root.findByType('button').props.onClick;let pending;await act(async()=>{pending=old();old();});assert.equal(f.calls.length,1);user={id:'other',role:'user'};await act(async()=>f.view.update(React.createElement(Component,props)));await act(async()=>{resolve({data:{data:{...absent,found:true,version:1,country:'US',approved:true}}});await pending;});assert.equal(f.view.root.findAllByType('input').length,0);await old();assert.equal(f.calls.length,1);}finally{await f.close();}});
