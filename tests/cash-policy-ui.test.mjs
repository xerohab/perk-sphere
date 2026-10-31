import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
let currentUser='STAFF-A',invoke;
globalThis.__cashPolicyUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useAuth:()=>({user:currentUser?{id:currentUser}:null}),base44:{functions:{invoke:(...args)=>invoke(...args)}}};
const raw=await readFile(new URL('../src/components/admin/CashPolicyControls.jsx',import.meta.url),'utf8');
const prefix="const {React,useEffect,useRef,useState,useAuth,base44}=globalThis.__cashPolicyUi; const Button='button';";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Controls}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const text=view=>JSON.stringify(view.toJSON());
const policy=(canManage=true)=>({data:{data:{configured:true,enabled:false,version:1,input_points:100,output_pence:20,currency:'GBP'},can_manage:canManage}});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(fn=async()=>policy()){
 currentUser='STAFF-A';const calls=[];invoke=(...args)=>{calls.push(args);return fn(...args);};let view;await act(async()=>{view=Renderer.create(React.createElement(Controls));});return {view,calls};
}
async function load(view){await act(async()=>{await view.root.findAllByType('button')[0].props.onClick();});}
test('cash policy panel never loads or saves automatically and respects server edit permission',async()=>{
 const {view,calls}=await fixture(async()=>policy(false));assert.equal(calls.length,0);await load(view);assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/Rules-management permission/);await act(async()=>view.unmount());
});
test('cash policy saves use observed version and reason; double submits write once and require reload',async()=>{
 const save=deferred();const {view,calls}=await fixture(async(name,body)=>body.action==='read'?policy():save.promise);await load(view);
 const reason=view.root.findByType('textarea');await act(async()=>reason.props.onChange({target:{value:'Approved synthetic policy test'}}));
 const form=view.root.findByType('form');let pending;await act(async()=>{pending=form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});});
 assert.equal(calls.filter(c=>c[1].action==='update').length,1);assert.equal(calls[1][1].expected_version,1);assert.equal(calls[1][1].reason,'Approved synthetic policy test');
 await act(async()=>{save.resolve({data:{data:{updated:true,member_gate_changed:false,payout_sent:false}}});await pending;});
 assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/Policy saved with an audit record/);await act(async()=>view.unmount());
});
test('uncertain policy write removes stale form and requires explicit reload',async()=>{
 const {view}=await fixture(async(name,b)=>{if(b.action==='read')return policy();throw Error('PRIVATE');});await load(view);
 await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'Synthetic reason'}}));
 await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/Reload before retrying/);assert.doesNotMatch(text(view),/PRIVATE/);await act(async()=>view.unmount());
});
test('account switch hides old policy immediately and late reads or retained callbacks cannot act for the next staff member',async()=>{
 const read=deferred();const {view,calls}=await fixture(()=>read.promise);let pending;const oldButton=view.root.findAllByType('button')[0].props.onClick;
 await act(async()=>{pending=oldButton();});currentUser='STAFF-B';await act(async()=>view.update(React.createElement(Controls)));
 assert.equal(view.root.findAllByType('form').length,0);
 await act(async()=>{read.resolve(policy());await pending;});assert.equal(view.root.findAllByType('form').length,0);
 await act(async()=>{await oldButton();});assert.equal(calls.length,1);await act(async()=>view.unmount());
});
