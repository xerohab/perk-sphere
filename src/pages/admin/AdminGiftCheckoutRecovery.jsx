import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import AccessGate from '@/components/perk/AccessGate';
import {Button} from '@/components/ui/button';
import {giftCheckoutRecoveryScope,projectGiftCheckoutRecovery} from '../../../base44/shared/giftCheckoutRecoveryContract.ts';
const guidance={
 request_new_quote:'This checkout never started order creation and its quote has expired. Review a fresh quote through the normal checkout flow.',
 review_original_prepared_checkout:'Order creation has not started. Review the original checkout before taking further action.',
 obtain_original_creation_evidence:'Creation started but no verified order receipt is stored. Obtain evidence for the original request. Do not create a replacement order.',
 reconcile_original_order:'A verified original order receipt exists. Reconcile that order before making any payment or delivery decision.'
};
export function CheckoutRecoveryForm(){
 const [scope,setScope]=useState({userReference:'',checkoutUuid:''}),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true),locked=useRef(false),epoch=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 const change=(key,value)=>{epoch.current++;setScope(s=>({...s,[key]:value}));setReport(null);setMessage('');};
 async function inspect(event){
  event.preventDefault();if(!mounted.current||locked.current)return;
  let command;try{command=giftCheckoutRecoveryScope(scope);}catch{setMessage('Enter a valid member reference and checkout UUID.');return;}
  const current=++epoch.current;locked.current=true;setBusy(true);setReport(null);setMessage('');
  try{
   const r=await base44.functions.invoke('inspectGiftCheckoutRecovery',command),data=projectGiftCheckoutRecovery(r.data,command);
   if(mounted.current&&epoch.current===current)setReport(data);
  }catch{if(mounted.current&&epoch.current===current)setMessage('Checkout recovery is paused or unavailable. No payment action was submitted.');}
  finally{locked.current=false;if(mounted.current&&epoch.current===current)setBusy(false);}
 }
 return <section className="space-y-5">
  <header><h1 className="text-2xl font-semibold">Gift checkout recovery</h1><p className="mt-2 text-sm text-muted-foreground">Inspect an existing checkout and its original order receipt. This page cannot create orders, capture payments or deliver gift cards.</p></header>
  <form onSubmit={inspect} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
   <label className="block text-sm">Member reference<input required maxLength={191} value={scope.userReference} disabled={busy} onChange={e=>change('userReference',e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
   <label className="block text-sm">Checkout UUID<input required maxLength={36} value={scope.checkoutUuid} disabled={busy} onChange={e=>change('checkoutUuid',e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
   <div><Button type="submit" disabled={busy}>{busy?'Inspecting…':'Inspect checkout'}</Button></div>
  </form>
  {message&&<p role="status" className="rounded border p-4 text-sm">{message}</p>}
  {report&&<section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Checkout recovery report">
   <h2 className="font-semibold">Original checkout</h2>
   <dl className="grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="text-muted-foreground">State</dt><dd>{report.state==='prepared'?'Prepared':'Order creation started'} · version {report.version}</dd></div>
    <div><dt className="text-muted-foreground">Environment</dt><dd>{report.mode==='sandbox'?'Sandbox':'Live'}</dd></div>
    <div><dt className="text-muted-foreground">Quote</dt><dd>{report.quoteExpired?'Expired':'Not expired'}</dd></div>
    <div><dt className="text-muted-foreground">Original order receipt</dt><dd>{report.orderReceiptPresent?'Recorded':'Not recorded'}</dd></div>
    <div className="sm:col-span-2"><dt className="text-muted-foreground">Original PayPal request ID</dt><dd className="break-all font-mono">{report.paypalRequestId}</dd></div>
    {report.paypalOrderReference&&<div className="sm:col-span-2"><dt className="text-muted-foreground">Original PayPal order ID</dt><dd className="break-all font-mono">{report.paypalOrderReference}</dd></div>}
   </dl>
   <p role="status" className="rounded border p-3 text-sm">{guidance[report.recoveryAction]}</p>
   <p className="text-xs text-muted-foreground">Snapshot only. Payment and delivery have not been verified. Inspection made no provider request and granted no purchase permission.</p>
  </section>}
 </section>;
}
export default function AdminGiftCheckoutRecovery(){
 const {user}=useAuth();
 return <AccessGate>{access=>access.permissions.includes('gift_checkout_recovery:read')&&user?.id?<CheckoutRecoveryForm key={user.id}/>:<p role="alert">Checkout recovery permission is required.</p>}</AccessGate>;
}
