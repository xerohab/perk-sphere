import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {cashBudgetPence,projectCashBudgetRead} from '../base44/shared/cashBudgetContract.ts';
let currentUser='STAFF-A',invoke;
globalThis.__cashBudgetUi={React,useEffect:React.useEffect,useRef:React.useRef,useState:React.useState,useAuth:()=>({user:currentUser?{id:currentUser}:null}),base44:{functions:{invoke:(...args)=>invoke(...args)}},cashBudgetPence,projectCashBudgetRead};
const raw=await readFile(new URL('../src/components/admin/CashBudgetControls.jsx',import.meta.url),'utf8');
const prefix="const {React,useEffect,useRef,useState,useAuth,base44,cashBudgetPence,projectCashBudgetRead}=globalThis.__cashBudgetUi;const Button='button';";
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Controls}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const text=view=>JSON.stringify(view.toJSON());
function snapshot(offset=0,has_more=false){return {data:{data:{configured:true,currency:'GBP',budget:{version:2,enabled:false,approved_limit_pence:'5000',allocated_pence:'1000',reserve_reference:'reserve-ref'},remaining_pence:'4000',history:[],limit:10,offset,has_more,provider_funding_verified:false,member_gate_changed:false,payout_sent:false}}};}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(fn=async()=>snapshot()){currentUser='STAFF-A';const calls=[];invoke=(...args)=>{calls.push(args);return fn(...args);};let view;await act(async()=>{view=Renderer.create(React.createElement(Controls));});return {view,calls};}
async function load(view){await act(async()=>{await view.root.findAllByType('button')[0].props.onClick();});}
async function reason(view){await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'Synthetic approval reason'}}));}
test('budget UI never fetches automatically and paused service cannot present an editable approval',async()=>{
 const {view,calls}=await fixture(async()=>{throw Error('PRIVATE');});assert.equal(calls.length,0);await load(view);assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/paused or unavailable/);assert.doesNotMatch(text(view),/PRIVATE/);await act(async()=>view.unmount());
});
test('budget UI preserves exact pence strings and locks duplicate approval submissions',async()=>{
 const save=deferred();const {view,calls}=await fixture(async(name,b)=>b.action==='read'?snapshot():save.promise);await load(view);await reason(view);
 await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'18446744073709551615'}}));
 const form=view.root.findByType('form');let pending;await act(async()=>{pending=form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});});
 assert.equal(calls.filter(c=>c[1].action==='update').length,1);assert.equal(calls[1][1].approved_limit_pence,'18446744073709551615');assert.equal(calls[1][1].expected_version,2);
 await act(async()=>{save.resolve({data:{data:{updated:true,provider_funding_verified:false,member_gate_changed:false,payout_sent:false}}});await pending;});
 assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/approval saved with an audit record/);await act(async()=>view.unmount());
});
test('budget UI rejects decimal currency input and uncertain saves require reload',async()=>{
 const {view,calls}=await fixture(async(name,b)=>{if(b.action==='read')return snapshot();throw Error('PRIVATE');});await load(view);await reason(view);
 await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'50.00'}}));await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}});});assert.equal(calls.length,1);
 await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'5000'}}));await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}});});assert.equal(view.root.findAllByType('form').length,0);assert.match(text(view),/Reload before retrying/);assert.doesNotMatch(text(view),/PRIVATE/);await act(async()=>view.unmount());
});
test('budget audit pagination uses bounded explicit offsets',async()=>{
 const {view,calls}=await fixture(async(name,b)=>snapshot(b.offset,b.offset===0));await load(view);
 const older=view.root.findAllByType('button').find(b=>b.props.children==='Older approvals');await act(async()=>{await older.props.onClick();});assert.equal(calls[1][1].offset,10);assert.equal(calls[1][1].limit,10);
 await act(async()=>view.unmount());
});
test('budget UI clears previous staff state and ignores retained or late callbacks after switching accounts',async()=>{
 const read=deferred();const {view,calls}=await fixture(()=>read.promise);let pending;const old=view.root.findAllByType('button')[0].props.onClick;
 await act(async()=>{pending=old();});currentUser='STAFF-B';await act(async()=>view.update(React.createElement(Controls)));assert.equal(view.root.findAllByType('form').length,0);
 await act(async()=>{read.resolve(snapshot());await pending;});assert.equal(view.root.findAllByType('form').length,0);await act(async()=>{await old();});assert.equal(calls.length,1);await act(async()=>view.unmount());
});
