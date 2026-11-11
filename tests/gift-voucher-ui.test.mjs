import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {giftVoucherRequest,projectGiftVoucherResult} from '../base44/shared/giftVoucherContract.ts';
let user={id:'owner',role:'user'},invoke;
globalThis.__voucherUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useCallback:React.useCallback,useAuth:()=>({user}),base44:{functions:{invoke:(...a)=>invoke(...a)}},giftVoucherRequest,projectGiftVoucherResult};
const raw=await readFile(new URL('../src/components/perk/GiftVoucherReveal.jsx',import.meta.url),'utf8');
const prefix="const {React,useEffect,useRef,useState,useCallback,useAuth,base44,giftVoucherRequest,projectGiftVoucherResult}=globalThis.__voucherUi;const Button='button';";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Component}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const id='12345678-1234-4234-8234-123456789012',other='32345678-1234-4234-8234-123456789012';
const voucher={voucherId:'synthetic',code:'SYNTHETIC-CODE',currency:'GBP',faceValueMinor:'1000',redemptionUrl:'https://example.invalid/redeem',expiresAt:null,instructions:'<img src=x onerror=alert(1)> Plain text.'};
const report=()=>({data:{data:{intent_uuid:id,voucher,duplicate:false,provider_delivery_verified:false}}});
const text=v=>JSON.stringify(v.toJSON());
async function fixture(fn=async()=>report()){
 user={id:'owner',role:'user'};const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window=new EventTarget();globalThis.document=new EventTarget();globalThis.document.visibilityState='visible';
 const calls=[];invoke=(...a)=>{calls.push(a);return fn(...a);};let view;await act(async()=>{view=Renderer.create(React.createElement(Component,{intentUuid:id}));});
 return {view,calls,cleanup:async()=>{await act(async()=>view.unmount());globalThis.window=oldWindow;globalThis.document=oldDocument;}};
}
test('voucher UI requires explicit reveal, renders receipt as text and hides on blur',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.length,0);await act(async()=>f.view.root.findByType('button').props.onClick());assert.match(text(f.view),/SYNTHETIC-CODE/);
  assert.equal(f.view.root.findAllByType('img').length,0);assert.equal(f.view.root.findByType('a').props.rel,'noopener noreferrer');assert.equal(f.view.root.findByType('a').props.referrerPolicy,'no-referrer');
  await act(async()=>window.dispatchEvent(new Event('blur')));assert.doesNotMatch(text(f.view),/SYNTHETIC-CODE/);
 }finally{await f.cleanup();}
});
test('voucher UI retains only the original in-memory request identity after failed response',async()=>{
 let n=0;const f=await fixture(async()=>{if(++n===1)throw Error('private');return report();});
 try{await act(async()=>f.view.root.findByType('button').props.onClick());assert.doesNotMatch(text(f.view),/private/);await act(async()=>f.view.root.findByType('button').props.onClick());assert.equal(f.calls[0][1].requestReference,f.calls[1][1].requestReference);}finally{await f.cleanup();}
});
test('voucher UI discards late account-switch responses, old callbacks and duplicate submissions',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r),f=await fixture(()=>pending);try{
  const old=f.view.root.findByType('button').props.onClick;let p;await act(async()=>{p=old();old();});assert.equal(f.calls.length,1);
  user={id:'other-owner',role:'user'};await act(async()=>f.view.update(React.createElement(Component,{intentUuid:id})));
  await act(async()=>{resolve(report());await p;});assert.doesNotMatch(text(f.view),/SYNTHETIC-CODE/);await old();assert.equal(f.calls.length,1);
 }finally{await f.cleanup();}
});
test('voucher and member-state changes clear the current reveal and refuse stale requests',async()=>{
 const f=await fixture();try{await act(async()=>f.view.root.findByType('button').props.onClick());const old=f.view.root.findAllByType('button')[0].props.onClick;
  await act(async()=>f.view.update(React.createElement(Component,{intentUuid:other})));assert.doesNotMatch(text(f.view),/SYNTHETIC-CODE/);
  user={id:'owner',role:'user',account_status:'banned'};await act(async()=>f.view.update(React.createElement(Component,{intentUuid:other})));assert.equal(f.view.root.findAllByType('button').length,0);assert.equal(f.calls.length,1);await old();
 }finally{await f.cleanup();}
});
