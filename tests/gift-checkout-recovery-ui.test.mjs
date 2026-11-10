import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {giftCheckoutRecoveryScope,projectGiftCheckoutRecovery} from '../base44/shared/giftCheckoutRecoveryContract.ts';
let user='A',invoke;
globalThis.__checkoutRecoveryUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useAuth:()=>({user:{id:user}}),base44:{functions:{invoke:(...a)=>invoke(...a)}},giftCheckoutRecoveryScope,projectGiftCheckoutRecovery};
const raw=await readFile(new URL('../src/pages/admin/AdminGiftCheckoutRecovery.jsx',import.meta.url),'utf8');
const prefix="const {React,useEffect,useRef,useState,useAuth,base44,giftCheckoutRecoveryScope,projectGiftCheckoutRecovery}=globalThis.__checkoutRecoveryUi;const Button='button';const AccessGate=({children})=>children({permissions:['gift_checkout_recovery:read']});";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Page}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const report={checkoutUuid:'12345678-1234-4234-8234-123456789012',paypalRequestId:'22345678-1234-4234-8234-123456789012',state:'create_started',version:2,mode:'sandbox',quoteExpired:true,orderReceiptPresent:false,paypalOrderReference:null,recoveryAction:'obtain_original_creation_evidence',providerCalls:0,creationAllowed:false,replacementOrderAllowed:false,paymentVerified:false,captureMade:false,dispatchAllowed:false,productionReady:false};
async function fixture(fn){user='A';const calls=[];invoke=(...a)=>{calls.push(a);return fn(...a);};let view;await act(async()=>{view=Renderer.create(React.createElement(Page));});await act(async()=>{const i=view.root.findAllByType('input');i[0].props.onChange({target:{value:'member'}});i[1].props.onChange({target:{value:report.checkoutUuid}});});return {view,calls};}
const text=v=>JSON.stringify(v.toJSON());
test('recovery UI reports unresolved original without payment action controls and clears changed scope',async()=>{
 const {view,calls}=await fixture(async()=>({data:{data:report}}));assert.equal(calls.length,0);
 await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.match(text(view),/Do not create a replacement/);assert.equal(view.root.findAllByType('button').length,1);
 await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'other'}}));assert.doesNotMatch(text(view),/22345678/);await act(async()=>view.unmount());
});
test('recovery UI ignores late account results and retained callbacks and locks duplicate submits',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),{view,calls}=await fixture(()=>pending);const old=view.root.findByType('form').props.onSubmit;let first;
 await act(async()=>{first=old({preventDefault(){}});old({preventDefault(){}});});assert.equal(calls.length,1);
 user='B';await act(async()=>view.update(React.createElement(Page)));await act(async()=>{resolve({data:{data:report}});await first;});
 assert.doesNotMatch(text(view),/22345678/);await old({preventDefault(){}});assert.equal(calls.length,1);await act(async()=>view.unmount());
});
