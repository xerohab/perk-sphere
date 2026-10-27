import React,{useState} from 'react';
import {base44} from '@/api/base44Client';
export default function VerifiedStreakAdmin({tasks}){
 const [campaign,setCampaign]=useState(''),[policy,setPolicy]=useState(null),[selected,setSelected]=useState([]),[start,setStart]=useState(''),[points,setPoints]=useState(''),[xp,setXp]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const available=tasks.filter(t=>t.reward_processing==='linux_partner'&&t.task_type==='watch_video'&&/^[a-f0-9]{24}$/.test(t.id||''));
 async function load(){
  if(!/^[A-Za-z0-9_:@.-]{1,100}$/.test(campaign)){setMessage('Enter a campaign reference.');return;}
  setBusy(true);setMessage('');
  try{const r=await base44.functions.invoke('manageVerifiedStreak',{action:'read',campaign_reference:campaign});const p=r.data?.data;if(!p||typeof p.configured!=='boolean')throw Error('unavailable');setPolicy(p);setSelected(p.configured?p.task_references:[]);setStart(p.configured?p.activity_after.slice(0,10):'');setPoints(p.configured?String(p.points):'');setXp(p.configured?String(p.xp):'');setEnabled(p.configured&&p.enabled===true);}catch{setPolicy(null);setMessage('Campaign administration is unavailable or you do not have permission.');}finally{setBusy(false);}
 }
 async function save(e){
  e.preventDefault();if(!policy||busy)return;
  const p=Number(points),x=Number(xp);if(selected.some(id=>!available.some(t=>t.id===id))){setMessage('Some selected tasks are not in the current list. Clear the selection and choose again.');return;}if(!start||!selected.length||![p,x].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)||p+x===0){setMessage('Choose tasks, a start date and a positive reward.');return;}
  setBusy(true);setMessage('');
  try{await base44.functions.invoke('manageVerifiedStreak',{action:'update',campaign_reference:campaign,expected_version:policy.configured?policy.version:0,enabled:policy.configured?enabled:false,task_references:selected,activity_after:policy.configured&&start===policy.activity_after.slice(0,10)?policy.activity_after:start+'T00:00:00.000Z',points:p,xp:x});await load();}
  catch{setMessage('Campaign could not be saved. Reload it before trying again.');}finally{setBusy(false);}
 }
 return <section className="rounded-2xl border p-5 space-y-3">
  <h2 className="font-semibold text-lg">Five-day task bonus</h2>
  <p>Choose video tasks. Only verified Xero Streams task receipts count; the list can include tasks from other partners. A member needs a qualifying task on each of five consecutive UTC days. New campaigns start disabled.</p>
  <div className="flex flex-wrap gap-2"><label>Campaign reference <input value={campaign} onChange={e=>{setCampaign(e.target.value);setPolicy(null);}} className="rounded border bg-transparent px-2"/></label><button type="button" disabled={busy} onClick={load} className="rounded border px-3 py-1">Load campaign</button></div>
  {policy&&<form onSubmit={save} className="space-y-3">
   <fieldset><legend>Video tasks</legend><button type="button" onClick={()=>setSelected([])} className="underline">Clear selection</button><div className="max-h-48 overflow-auto space-y-1">{available.map(t=><label key={t.id} className="block"><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(e.target.checked?[...selected,t.id]:selected.filter(x=>x!==t.id))}/> {t.name||t.content_title||'Video task'} {t.destination_name?' · '+t.destination_name:''}</label>)}</div></fieldset>
   <div className="flex flex-wrap gap-3"><label>Start date (UTC) <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="block rounded border bg-transparent px-2"/></label><label>Points <input type="number" min="0" max="1000000" value={points} onChange={e=>setPoints(e.target.value)} className="block rounded border bg-transparent px-2"/></label><label>XP <input type="number" min="0" max="1000000" value={xp} onChange={e=>setXp(e.target.value)} className="block rounded border bg-transparent px-2"/></label></div>
   <label><input type="checkbox" disabled={!policy.configured} checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enabled</label>{' '}<button type="submit" disabled={busy} className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Save campaign</button>
  </form>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
