import React,{useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {xpPolicyUpdate} from '@/lib/xp-policy-form';
import {Button} from '@/components/ui/button';
export default function XpConversionPolicyControls({administrationEnabled,conversionEnabled}){
 const [policy,setPolicy]=useState(null),[inputXp,setInputXp]=useState(''),[outputPoints,setOutputPoints]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const generation=useRef(0),lock=useRef(false);
 const load=useCallback(async()=>{
  const current=++generation.current;setPolicy(null);setLoading(true);
  try{
   const response=await base44.functions.invoke('manageXpConversion',{action:'read'}),data=response.data?.data;
   if(!data||typeof data.configured!=='boolean'||data.configured&&(![data.version,data.input_xp,data.output_points].every(n=>Number.isSafeInteger(n)&&n>0)||typeof data.enabled!=='boolean'))throw Error();
   if(current===generation.current){setPolicy(data);setInputXp(data.configured?String(data.input_xp):'');setOutputPoints(data.configured?String(data.output_points):'');setEnabled(data.configured?data.enabled:false);}
  }catch{if(current===generation.current)setMessage('Conversion rules could not be loaded. Rules-management permission and the administration service are required.');}
  finally{if(current===generation.current)setLoading(false);}
 },[]);
 useEffect(()=>{if(administrationEnabled)load();return ()=>{generation.current++;};},[administrationEnabled,load]);
 async function save(event){
  event.preventDefault();if(lock.current||!policy)return;let body;
  try{body=xpPolicyUpdate({policy,inputXp,outputPoints,enabled});}catch{setMessage('Enter whole positive XP and Points values, up to 1,000,000,000.');return;}
  lock.current=true;setBusy(true);setMessage('');
  try{const response=await base44.functions.invoke('manageXpConversion',body);if(response.data?.data?.updated!==true)throw Error();setMessage('Policy saved with a new version and audit record. This does not change the member conversion feature gate.');await load();}
  catch{setMessage('Policy update could not be confirmed. Reload the policy before retrying; another administrator may have changed it.');setPolicy(null);}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="rounded-xl border bg-card p-5 space-y-4">
  <h2 className="font-semibold">XP-to-Points policy</h2>
  <p className="text-sm text-muted-foreground">Member conversion is {conversionEnabled?'enabled':'paused'}. Saving a rate here does not enable that feature gate. No rate is supplied automatically, and these settings do not assign Points a cash value.</p>
  {!administrationEnabled?<p className="text-sm">Policy administration is paused.</p>:<>
   <Button variant="outline" disabled={busy||loading} onClick={load}>{loading?'Loading policy…':'Reload conversion policy'}</Button>
   {policy&&<form onSubmit={save} className="space-y-3">
    <p className="text-sm">{policy.configured?'Current policy version: '+policy.version:'No rate configured. The first policy is always saved disabled.'}</p>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">XP per increment<input required inputMode="numeric" type="text" value={inputXp} disabled={busy} onChange={e=>setInputXp(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label><label className="text-sm">Points per increment<input required inputMode="numeric" type="text" value={outputPoints} disabled={busy} onChange={e=>setOutputPoints(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy||!policy.configured} checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enable this policy once the separate member conversion gate is approved</label>
    <Button type="submit" disabled={busy||loading}>{busy?'Saving…':'Save conversion policy'}</Button>
   </form>}
  </>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
