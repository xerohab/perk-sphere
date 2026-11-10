import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {GIFT_SOURCE_EVENTS,giftSourceCommand,projectGiftSourceResult} from '../base44/shared/giftSourceContract.ts';
let currentUser='STAFF-A',invoke;
globalThis.__giftSourceUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useAuth:()=>({user:currentUser?{id:currentUser}:null}),base44:{functions:{invoke:(...args)=>invoke(...args)}},GIFT_SOURCE_EVENTS,giftSourceCommand,projectGiftSourceResult};
const raw=await readFile(new URL('../src/pages/admin/AdminGiftSources.jsx',import.meta.url),'utf8');
const prefix="const {React,useEffect,useRef,useState,useAuth,base44,GIFT_SOURCE_EVENTS,giftSourceCommand,projectGiftSourceResult}=globalThis.__giftSourceUi;const Button='button';const AccessGate=({children})=>children({permissions:['gift_notification_sources:manage']});";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Page}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const scope={mode:'sandbox',merchantReference:'MERCHANT',webhookReference:'HOOK'};
const source={...scope,state:'active',credentialVersion:'v1',intakeActorReference:'intake',workerActorReference:'worker',eventTypes:['PAYMENT.CAPTURE.REFUNDED']};
const report=()=>({data:{production_ready:false,data:{version:1,source,financial_clearance_verified:false}}});
const text=v=>JSON.stringify(v.toJSON());
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(fn=async()=>report()){currentUser='STAFF-A';const calls=[];invoke=(...args)=>{calls.push(args);return fn(...args);};let view;await act(async()=>{view=Renderer.create(React.createElement(Page));});return {view,calls};}
async function fill(view){const inputs=view.root.findAllByType('input');await act(async()=>{inputs[0].props.onChange({target:{value:'MERCHANT'}});inputs[1].props.onChange({target:{value:'HOOK'}});});}
async function load(view){await fill(view);await act(async()=>{await view.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}});});}
test('source UI requires explicit load and unavailable service never exposes a save form',async()=>{
 const {view,calls}=await fixture(async()=>{throw Error('PRIVATE');});assert.equal(calls.length,0);await load(view);assert.equal(view.root.findAllByType('form').length,1);assert.match(text(view),/paused or unavailable/);assert.doesNotMatch(text(view),/PRIVATE/);await act(async()=>view.unmount());
});
test('source UI saves exact loaded revision as paused and blocks repeated submissions',async()=>{
 const saved=deferred(),{view,calls}=await fixture(async(_,b)=>b.action==='read'?report():saved.promise);await load(view);let pending;
 const save=view.root.findAllByType('form')[1].props.onSubmit;
 await act(async()=>{pending=save({preventDefault(){}});save({preventDefault(){}});});
 assert.equal(calls.length,2);assert.equal(calls[1][1].expectedVersion,1);assert.equal(calls[1][1].source.state,'paused');
 await act(async()=>{saved.resolve({data:{production_ready:false,data:{version:2,replayed:false,financial_clearance_verified:false}}});await pending;});
 assert.equal(view.root.findAllByType('form').length,1);assert.match(text(view),/revision saved/);await act(async()=>view.unmount());
});
test('scope changes invalidate loaded revision and uncertain saves cannot be retried without reload',async()=>{
 const {view,calls}=await fixture(async(_,b)=>{if(b.action==='read')return report();throw Error('PRIVATE');});await load(view);
 await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'OTHER'}}));assert.equal(view.root.findAllByType('form').length,1);
 await load(view);await act(async()=>{await view.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}});});
 assert.equal(view.root.findAllByType('form').length,1);assert.match(text(view),/may already have committed/);assert.doesNotMatch(text(view),/PRIVATE/);assert.equal(calls.filter(c=>c[1].action==='revise').length,1);await act(async()=>view.unmount());
});
test('account switches clear source metadata and ignore late or retained callbacks',async()=>{
 const read=deferred(),{view,calls}=await fixture(()=>read.promise);await fill(view);const old=view.root.findAllByType('form')[0].props.onSubmit;let pending;
 await act(async()=>{pending=old({preventDefault(){}});});currentUser='STAFF-B';await act(async()=>view.update(React.createElement(Page)));
 await act(async()=>{read.resolve(report());await pending;});assert.equal(view.root.findAllByType('form').length,1);assert.doesNotMatch(text(view),/Version 1|intake/);
 await act(async()=>{await old({preventDefault(){}});});assert.equal(calls.length,1);await act(async()=>view.unmount());
});
