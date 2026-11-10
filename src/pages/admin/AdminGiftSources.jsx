import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import AccessGate from '@/components/perk/AccessGate';
import {Button} from '@/components/ui/button';
import {GIFT_SOURCE_EVENTS,giftSourceCommand,projectGiftSourceResult} from '../../../base44/shared/giftSourceContract.ts';
const emptyScope={mode:'sandbox',merchantReference:'',webhookReference:''};
function SourceForm(){
 const [scope,setScope]=useState(emptyScope),[snapshot,setSnapshot]=useState(null),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[operations,setOperations]=useState(null);
 const mounted=useRef(true),lock=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const editScope=(key,value)=>{setScope(s=>({...s,[key]:value}));setSnapshot(null);setForm(null);setOperations(null);setMessage('');};
 async function load(event){
  event.preventDefault();if(!mounted.current||lock.current)return;
  let command;try{command=giftSourceCommand({action:'read',source:scope});}catch{setMessage('Enter a merchant ID and webhook ID in the displayed format.');return;}
  lock.current=true;setBusy(true);setSnapshot(null);setForm(null);setOperations(null);setMessage('');
  try{
   const r=await base44.functions.invoke('manageGiftNotificationSources',command),data=projectGiftSourceResult(r.data,command);
   if(!mounted.current)return;setSnapshot(data);setForm(data.source||{...command.source,credentialVersion:'',intakeActorReference:'',workerActorReference:'',state:'paused',eventTypes:[]});
  }catch{if(mounted.current)setMessage('Source administration is paused or unavailable. No source change was submitted.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(!mounted.current||lock.current||!snapshot||!form)return;
  let command;try{command=giftSourceCommand({action:'revise',expectedVersion:snapshot.version,source:{...form,state:'paused'}});}catch{setMessage('Complete the source metadata and choose at least one event type.');return;}
  lock.current=true;setBusy(true);setMessage('');
  try{
   const r=await base44.functions.invoke('manageGiftNotificationSources',command);projectGiftSourceResult(r.data,command);
   if(mounted.current){setSnapshot(null);setForm(null);setOperations(null);setMessage('Paused source revision saved. Load it again to inspect the committed version.');}
  }catch{if(mounted.current){setSnapshot(null);setForm(null);setOperations(null);setMessage('The update could not be confirmed. Load the source before retrying; it may already have committed.');}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }

 async function inspectOperations(){
  if(!mounted.current||lock.current||!snapshot)return;
  const command=giftSourceCommand({action:'operations',source:scope});
  lock.current=true;setBusy(true);setOperations(null);setMessage('');
  try{
   const r=await base44.functions.invoke('manageGiftNotificationSources',command),data=projectGiftSourceResult(r.data,command);
   if(mounted.current)setOperations(data);
  }catch{if(mounted.current)setMessage('Queue inspection is unavailable. No event was retried or changed.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 const input=(name,label,pattern,maxLength)=><label className="block text-sm" key={name}>{label}<input required pattern={pattern} maxLength={maxLength} value={form[name]} disabled={busy} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} className="mt-1 block w-full rounded border bg-background p-2"/></label>;
 return <section className="space-y-5">
  <div><h1 className="text-2xl font-semibold">Gift notification sources</h1><p className="mt-2 text-sm text-muted-foreground">Inspect a payment-notification source or save it in a paused state. Source registration does not verify a provider or enable gift-card purchases.</p></div>
  <form onSubmit={load} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
   <label className="block text-sm">Environment<select value={scope.mode} disabled={busy} onChange={e=>editScope('mode',e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"><option value="sandbox">Sandbox</option><option value="live">Live</option></select></label>
   <label className="block text-sm">Merchant ID<input required pattern="[A-Z0-9]{1,100}" maxLength={100} value={scope.merchantReference} disabled={busy} onChange={e=>editScope('merchantReference',e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/><span className="text-xs text-muted-foreground">Uppercase letters and digits.</span></label>
   <label className="block text-sm">Webhook ID<input required pattern="[A-Za-z0-9_-]{1,100}" maxLength={100} value={scope.webhookReference} disabled={busy} onChange={e=>editScope('webhookReference',e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
   <div className="flex items-end"><Button disabled={busy} type="submit">{busy?'Working…':'Load source'}</Button></div>
  </form>
  {snapshot&&form&&<form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5">
   <p className="text-sm">{snapshot.version===0?'No source registered. The first revision will be paused.':'Version '+snapshot.version+' · '+snapshot.source.state}</p>
   <p className="text-sm text-muted-foreground">Enter metadata references only. Credentials and access tokens belong in secure configuration.</p>
   {input('credentialVersion','Credential version','[A-Za-z0-9_.:-]{1,100}',100)}
   {input('intakeActorReference','Intake actor reference','[A-Za-z0-9_:@.\\-]{1,191}',191)}
   {input('workerActorReference','Worker actor reference','[A-Za-z0-9_:@.\\-]{1,191}',191)}
   <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 text-sm font-medium">Notification event types</legend>{GIFT_SOURCE_EVENTS.map(type=><label key={type} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.eventTypes.includes(type)} onChange={e=>setForm(f=>({...f,eventTypes:e.target.checked?[...f.eventTypes,type]:f.eventTypes.filter(t=>t!==type)}))}/><span className="break-all">{type}</span></label>)}</fieldset>
   <p className="text-sm">Saving pauses this source. Activation requires separate provider checks and operational setup.</p>
   <Button disabled={busy||snapshot.version>=100} type="submit">Save paused source</Button>
   {snapshot.version>=100&&<p role="status" className="text-sm">This source has reached its revision limit and needs operator review.</p>}
  </form>}

  {snapshot&&<section className="space-y-4 rounded-xl border bg-card p-5">
   <h2 className="font-semibold">Queue and recovery</h2>
   <p className="text-sm text-muted-foreground">Inspect this merchant, environment and webhook only. Worker uptime and global audit integrity are separate checks.</p>
   <Button type="button" variant="outline" disabled={busy} onClick={inspectOperations}>Check queue and recovery</Button>
   {operations&&!operations.schemaAvailable&&<p role="status" className="rounded border p-3 text-sm">Queue storage is missing or inaccessible to this API. This source cannot yet be monitored.</p>}
   {operations?.schemaAvailable&&<>
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['pending','Pending'],['processing','Processing'],['retry','Scheduled retries'],['dead','Dead letters'],['expiredLeases','Expired leases'],['overdueUnresolved','Overdue events']].map(([key,label])=><div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{operations.counts[key]}</dd></div>)}</dl>
    <p role="status" className="text-sm">{operations.issues.length?'Operator review required: '+operations.issues.map(key=>({unknownStates:'unknown queue states',expiredLeases:'expired processing leases',overdueUnresolved:'overdue unresolved events',dead:'dead-letter events',capacity_review_required:'queue exceeds the bounded inspection limit',merchant_mutex_unavailable:'merchant lock record unavailable',integrity_mismatches:'original audit does not match current state'})[key]).join('; '):'No issues detected in this source snapshot.'}</p>
    <p className="text-xs text-muted-foreground">{operations.scopeIntegrityChecked?'Original histories for this source were checked.':'Original histories have not been fully checked.'} Worker uptime has not been verified.</p>
    {operations.cases.length>0&&<div className="space-y-2"><h3 className="text-sm font-semibold">Recovery review</h3><ol className="space-y-2">{operations.cases.map(c=><li key={c.notificationHash}><details className="rounded border p-3 text-sm"><summary className="cursor-pointer font-medium">{c.state} · attempt {c.attempts}</summary><div className="mt-2 space-y-2"><p>{{operator_reconciliation:'Inspect the original receipt and reconcile the outcome before considering any retry.',review_expired_lease:'Review the expired original lease and its committed receipt. Expiry alone does not prove that processing failed.',await_current_lease:'An original processing lease is still current. Wait for its outcome.',await_worker:'Await the registered worker or its scheduled retry. This inspection does not claim the event.'}[c.recoveryAction]}</p><p className="break-all font-mono text-xs">{c.notificationHash}</p><p>Version {c.version} · available {new Date(c.availableAt).toLocaleString()}</p>{c.leaseUntil&&<p>Lease until {new Date(c.leaseUntil).toLocaleString()}</p>}</div></details></li>)}</ol>{operations.hasMoreCases&&<p className="text-xs">Showing 20 validated cases. Additional cases require review.</p>}</div>}
   </>}
   {operations&&<p className="text-xs text-muted-foreground">Read-only inspection: no event retries, hold releases, purchases or payouts are submitted.</p>}
  </section>}

  {message&&<p role="status" className="rounded border p-4 text-sm">{message}</p>}
 </section>;
}
export default function AdminGiftSources(){
 const {user}=useAuth();
 return <AccessGate>{access=>access.permissions.includes('gift_notification_sources:manage')&&user?.id?<SourceForm key={user.id}/>:<p role="alert">Source-management permission is required.</p>}</AccessGate>;
}