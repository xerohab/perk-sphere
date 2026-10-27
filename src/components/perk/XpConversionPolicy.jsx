import React,{useState} from 'react';
import {base44} from '@/api/base44Client';
export default function XpConversionPolicy(){
 const [policy,setPolicy]=useState(null),[input,setInput]=useState(''),[output,setOutput]=useState(''),[enabled,setEnabled]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setStatus('');
  try{const r=await base44.functions.invoke('manageXpConversion',{action:'read'});const p=r.data?.data;if(!p||typeof p.configured!=='boolean')throw Error('unavailable');setPolicy(p);setInput(p.configured?String(p.input_xp):'');setOutput(p.configured?String(p.output_points):'');setEnabled(p.configured&&p.enabled===true);}
  catch{setStatus('Rate administration is unavailable or you do not have permission.');}finally{setBusy(false);}
 }
 async function save(e){
  e.preventDefault();if(!policy||busy)return;
  const xp=Number(input),points=Number(output);if(![xp,points].every(n=>Number.isSafeInteger(n)&&n>0&&n<=1000000000)){setStatus('Enter positive whole-number rates.');return;}
  setBusy(true);setStatus('');
  try{await base44.functions.invoke('manageXpConversion',{action:'update',expected_version:policy.configured?policy.version:0,enabled:policy.configured?enabled:false,input_xp:xp,output_points:points});setStatus('Rate saved.');await load();}
  catch{setStatus('The rate could not be saved. Reload it before trying again.');}finally{setBusy(false);}
 }
 return <section className="rounded-2xl border p-5 space-y-3">
  <h2 className="text-lg font-semibold">XP conversion rate</h2>
  <p>Set how much XP converts to points. A new rate starts disabled.</p>
  <button type="button" onClick={load} disabled={busy} className="rounded border px-3 py-2">Load rate</button>
  {policy&&<form onSubmit={save} className="flex flex-wrap items-end gap-3">
   <label>XP <input type="number" min="1" max="1000000000" value={input} onChange={e=>setInput(e.target.value)} className="block rounded border bg-transparent px-2 py-1"/></label>
   <label>Points <input type="number" min="1" max="1000000000" value={output} onChange={e=>setOutput(e.target.value)} className="block rounded border bg-transparent px-2 py-1"/></label>
   <label><input type="checkbox" checked={enabled} disabled={!policy.configured} onChange={e=>setEnabled(e.target.checked)}/> Enabled</label>
   <button disabled={busy} type="submit" className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Save rate</button>
  </form>}
  {status&&<p role="status">{status}</p>}
 </section>;
}
