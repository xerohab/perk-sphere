import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {Button} from '@/components/ui/button';
function CashPolicyForm(){
 const [policy,setPolicy]=useState(null),[canManage,setCanManage]=useState(false),[input,setInput]=useState(''),[output,setOutput]=useState(''),[reason,setReason]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true),lock=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function load(){
  if(!mounted.current||lock.current)return;lock.current=true;setBusy(true);setPolicy(null);setCanManage(false);setMessage('');
  try{
   const r=await base44.functions.invoke('manageCashConversionPolicy',{action:'read'}),p=r.data?.data;
   if(!p||typeof p.configured!=='boolean'||typeof r.data.can_manage!=='boolean'||p.configured&&(typeof p.enabled!=='boolean'||p.currency!=='GBP'||![p.version,p.input_points,p.output_pence].every(n=>Number.isSafeInteger(n)&&n>0)))throw Error();
   if(!mounted.current)return;setPolicy(p);setCanManage(r.data.can_manage);setInput(p.configured?String(p.input_points):'');setOutput(p.configured?String(p.output_pence):'');setEnabled(p.configured?p.enabled:false);setReason('');
  }catch{if(mounted.current)setMessage('Cash policy administration is paused or unavailable. No rate was changed.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(!mounted.current||lock.current||!policy||!canManage)return;
  const whole=v=>/^[1-9][0-9]{0,9}$/.test(v)&&Number(v)<=1000000000;
  if(!whole(input)||!whole(output)||reason.trim().length<5||reason.length>1000){setMessage('Enter whole positive Points and pence values up to 1,000,000,000, plus a reason of 5–1,000 characters.');return;}
  lock.current=true;setBusy(true);setMessage('');
  try{
   const r=await base44.functions.invoke('manageCashConversionPolicy',{action:'update',expected_version:policy.configured?policy.version:0,enabled:policy.configured?enabled:false,input_points:Number(input),output_pence:Number(output),reason:reason.trim()});
   if(r.data?.data?.updated!==true||r.data.data.member_gate_changed!==false||r.data.data.payout_sent!==false)throw Error();
   if(mounted.current){setPolicy(null);setMessage('Policy saved with an audit record. Member cash and payout gates were not changed. Reload to inspect the new version.');}
  }catch{if(mounted.current){setPolicy(null);setMessage('The update could not be confirmed. Reload before retrying; another administrator may have changed the policy.');}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="rounded-xl border bg-card p-5 space-y-4">
  <h2 className="font-semibold">Points-to-GBP policy preparation</h2>
  <p className="text-sm text-muted-foreground">Cash remains unavailable to members. This administration control does not fund cash, enable conversion or send a payout. No production rate is preselected. A new policy starts disabled.</p>
  <Button variant="outline" disabled={busy} onClick={load}>{busy?'Working…':'Check cash policy administration'}</Button>
  {policy&&<p className="text-sm">{policy.configured?'Version '+policy.version+' · '+policy.input_points+' Points → '+policy.output_pence+' pence GBP · policy '+(policy.enabled?'enabled':'disabled'):'No cash rate configured.'}</p>}
  {policy&&canManage&&<form onSubmit={save} className="space-y-3">
   <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Points per increment<input required inputMode="numeric" value={input} disabled={busy} onChange={e=>setInput(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label><label className="text-sm">GBP pence per increment<input required inputMode="numeric" value={output} disabled={busy} onChange={e=>setOutput(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/><span className="text-xs text-muted-foreground">100 pence = £1.00</span></label></div>
   <label className="block text-sm">Reason for this revision<textarea required minLength={5} maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={busy||!policy.configured} onChange={e=>setEnabled(e.target.checked)}/>Enable policy after funding and rollout review; member gates remain separate</label>
   <Button type="submit" disabled={busy}>{busy?'Saving…':'Save cash policy'}</Button>
  </form>}
  {policy&&!canManage&&<p className="text-sm">Your staff role can inspect this policy. Rules-management permission is required to edit it.</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
export default function CashPolicyControls(){const {user}=useAuth();return user?.id?<CashPolicyForm key={'cash-policy:'+user.id}/>:null;}
