import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {formatSeconds,isTrustedProgress} from '../src/lib/task-utils.js';
const raw=await readFile(new URL('../src/components/perk/TaskCard.jsx',import.meta.url),'utf8');
const iconImport=raw.match(/import \{([^}]+)\} from "lucide-react";/)[1];
globalThis.__taskCard={React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},formatSeconds,isTrustedProgress};
const prefix="const {React,formatSeconds,isTrustedProgress}=globalThis.__taskCard; const Link='Link',Button='Button',ProgressBar='ProgressBar';const cn=(...v)=>v.filter(Boolean).join(' ');const "+iconImport.split(',').map(s=>s.trim()).filter(Boolean).map(n=>n+"='"+n+"'").join(',')+";";
const code=prefix+raw.replace(/^import .*;\r?\n/gm,'');
const {default:TaskCard}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
function nodes(value){if(!value||typeof value!=='object')return [];if(Array.isArray(value))return value.flatMap(nodes);return [value,...nodes(value.props?.children)];}
function text(value){if(value==null||typeof value==='boolean')return '';if(Array.isArray(value))return value.map(text).join(' ');if(typeof value==='object')return text(value.props?.children);return String(value);}
const task={id:'task',name:'Example',task_type:'complete_activity'};
test('dashboard card without action callbacks navigates to tasks',()=>{
 const card=TaskCard({task,isAuthed:true});assert.ok(nodes(card).some(n=>n.type==='Link'&&n.props.to==='/tasks'&&text(n)==='View task'));
 let starts=0;const interactive=TaskCard({task,isAuthed:true,onStart:()=>starts++});const start=nodes(interactive).find(n=>n.type==='Button'&&text(n).includes('Start Task'));assert.ok(start);start.props.onClick();assert.equal(starts,1);
});
test('first-party verified tasks point to partner accounts rather than extension install',()=>{
 const card=TaskCard({task:{...task,reward_processing:'linux_partner',verification_mode:'client_assisted'},isAuthed:true});
 assert.match(text(card),/Verified partner activity required/);assert.doesNotMatch(text(card),/Browser extension required/);assert.ok(nodes(card).some(n=>n.type==='Link'&&n.props.to==='/partner-accounts'));
});
test('future and expired tasks cannot open automatic content',()=>{
 for(const data of [{available_from:'2999-01-01T00:00:00Z'},{available_until:'2000-01-01T00:00:00Z'}]){
 const card=TaskCard({task:{...task,...data,verification_mode:'trusted_automatic',content_url:'https://example.test'},isAuthed:true});assert.equal(nodes(card).filter(n=>n.type==='a').length,0);assert.ok(nodes(card).some(n=>n.type==='Button'&&n.props.disabled));
 }
});
test.after(()=>delete globalThis.__taskCard);
