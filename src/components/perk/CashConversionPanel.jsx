import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {formatGbpPence} from '@/lib/member-cash-wallet-client';
import {requestCashConversion} from '@/lib/cash-conversion-client';
import {pendingCashRecovery,readCashRecovery,saveCashRecovery,submitCashRecovery,clearConfirmedCashRecovery} from '@/lib/cash-conversion-recovery';
import {quoteCashConversion} from '../../../base44/shared/cashConversionContract.ts';
function Panel({user,onConfirmed=async()=>{}}){
 const [show,setShow]=useState(false),[info,setInfo]=useState(null),[record,setRecord]=useState(null),[input,setInput]=useState(''),[receipt,setReceipt]=useState(null),[blocked,setBlocked]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const mounted=useRef(false),generation=useRef(0),running=useRef(false);
 const load=useCallback(async()=>{
  if(running.current)return;running.current=true;setBusy(true);setInfo(null);setNotice('');const token=++generation.current,current=()=>mounted.current&&generation.current===token;
  let saved=null,recoveryError=false;
  try{saved=readCashRecovery(sessionStorage,user.id);}catch{recoveryError=true;}
  try{const policy=await requestCashConversion({base44,actorId:user.id,body:{action:'policy'},isCurrent:current});if(current()){setInfo(policy);setRecord(saved);setBlocked(recoveryError);setShow(policy.available||!!saved||recoveryError);setInput(saved?String(saved.request.points):'');setReceipt(saved?.status==='confirmed'?saved.receipt:null);if(recoveryError)setNotice('Saved conversion details could not be read. Contact support before starting another conversion.');else if(saved)setNotice(saved.status==='confirmed'?'A saved confirmation is retained. Clear its recovery record before a new conversion.':'An earlier conversion awaits confirmation. Review and retry the original request; no replacement has been sent.');}}
  catch{if(current()){setInfo(null);setRecord(saved);setBlocked(recoveryError);setShow(!!saved||recoveryError);setNotice('Conversion availability could not be checked. Saved recovery details have not been deleted.');}}
  finally{if(current()){running.current=false;setBusy(false);}}
 },[user.id]);
 useEffect(()=>{mounted.current=true;load();const clear=()=>{generation.current++;running.current=false;setBusy(false);setInfo(null);setRecord(null);setReceipt(null);setInput('');setNotice('Review availability and saved recovery details before submitting.');};window.addEventListener('focus',clear);document.addEventListener('visibilitychange',clear);return()=>{mounted.current=false;generation.current++;running.current=false;window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',clear);};},[load]);
 const policy=info?.configured?info.policy:null;let quote=null;try{if(/^[1-9]\d*$/.test(input))quote=quoteCashConversion(Number(input),policy);}catch{}
 async function convert(event){
  event.preventDefault();if(running.current||blocked||!info?.available||record?.status==='confirmed')return;
  running.current=true;setBusy(true);setNotice('');const token=++generation.current,current=()=>mounted.current&&generation.current===token;
  try{
   let saved=readCashRecovery(sessionStorage,user.id);
   if(saved&&!record){setRecord(saved);setInput(String(saved.request.points));setNotice('A saved request was found. Review it and explicitly retry its original amount.');return;}
   if(saved&&record&&JSON.stringify(saved)!==JSON.stringify(record))throw Error('CASH_RECOVERY_CHANGED');
   if(!saved){if(record)throw Error('CASH_RECOVERY_CHANGED');if(!quote||!policy?.enabled)return;const created=pendingCashRecovery({actorId:user.id,points:Number(input),policy,requestReference:crypto.randomUUID()});saveCashRecovery(sessionStorage,user.id,created);saved=created;setRecord(saved);}
   const result=await submitCashRecovery({base44,storage:sessionStorage,actorId:user.id,isCurrent:current});if(!current())return;
   if(result.state==='policy_changed'){setRecord(null);setInput('');setInfo(null);setNotice('The original request was rejected because the rate changed. Review the current policy before a new conversion.');return;}
   setReceipt(result.receipt);setRecord(result.recovery_cleared?null:readCashRecovery(sessionStorage,user.id));setInfo(null);setInput('');setNotice(result.recovery_cleared?'Conversion recorded. No payment was sent. Review availability before another conversion.':'Conversion recorded, but its saved confirmation could not be cleared. No new conversion can start.');
   try{await onConfirmed();}catch{if(current())setNotice('Conversion recorded. Balance refresh failed; check your Points and cash history. Do not submit a replacement.');}
  }catch{if(current()){try{const saved=readCashRecovery(sessionStorage,user.id);setRecord(saved);if(!saved)setBlocked(true);}catch{setBlocked(true);}setNotice('The conversion could not be confirmed or recovery storage is unavailable. Keep the original request and contact support if retry remains unavailable. No replacement request was sent.');}}
  finally{if(current()){running.current=false;setBusy(false);}}
 }
 function clearConfirmation(){if(running.current)return;try{clearConfirmedCashRecovery(sessionStorage,user.id);setRecord(null);setReceipt(null);setInput('');setInfo(null);setNotice('Saved confirmation cleared. Review availability before a new conversion.');}catch{setNotice('The saved confirmation could not be cleared. New conversions remain blocked.');}}
 if(!show)return null;
 return <section className="rounded-2xl border p-5 space-y-4" aria-labelledby="cash-conversion-heading">
  <h2 id="cash-conversion-heading" className="font-semibold">Convert Points to GBP accounting balance</h2>
  <p className="text-sm">This exchanges Points for an internal GBP balance under the displayed policy. It spends Points, sends no payment and does not enable withdrawals, gift cards, top-ups or currency exchange. This page cannot reverse a conversion.</p>
  <Button variant="outline" disabled={busy} onClick={load}>{busy?'Checking…':'Review availability and recovery'}</Button>
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {blocked&&<p className="text-sm">Recovery needs review. New conversions are blocked.</p>}
  {receipt&&<div className="rounded border p-3 text-sm"><p>{receipt.points_spent} Points → {formatGbpPence(receipt.credited_pence)} recorded GBP balance.</p><p>{record?.status==='confirmed'?'Saved confirmation; check the authoritative wallet history.':receipt.duplicate?'The original conversion was confirmed again; no second credit was issued.':'Conversion receipt confirmed.'} No payment was sent.</p><p className="break-all text-xs">Receipt: {receipt.operation_uuid}</p></div>}
  {record?.status==='confirmed'&&<Button variant="outline" disabled={busy||blocked} onClick={clearConfirmation}>Clear saved confirmation</Button>}
  {record?.status==='pending'?<div className="space-y-3 text-sm"><p>Original request: {record.request.points} Points → {formatGbpPence(record.credited_pence)}, policy {record.request.policy_version}. The original identity and terms stay fixed.</p><form onSubmit={convert}><Button type="submit" disabled={busy||blocked||!info?.available}>Retry original conversion</Button></form></div>:!record&&info?.available&&policy?.enabled?<form onSubmit={convert} className="space-y-3"><p className="text-sm">{policy.input_points} Points → {formatGbpPence(String(policy.output_pence))} GBP balance. Policy {policy.version}. The server checks balance, budget and eligibility at confirmation.</p><label className="block text-sm" htmlFor="cash-points">Whole Points amount</label><input id="cash-points" type="text" inputMode="numeric" value={input} disabled={busy||blocked} onChange={e=>setInput(e.target.value)} className="rounded border bg-background px-3 py-2"/>{quote&&<p className="text-sm">Preview only: {input} Points → {formatGbpPence(quote)}. No funds move until you confirm.</p>}<Button type="submit" disabled={busy||blocked||!quote}>Confirm Points conversion</Button></form>:!record&&<p className="text-sm">Conversion is unavailable or needs a reviewed enabled rate. No default cash value is assigned to Points.</p>}
  {record?.status==='pending'&&!info?.available&&<p className="text-sm">Conversion is paused or unavailable. The saved request is retained.</p>}
 </section>;
}
export default function CashConversionPanel({onConfirmed}){const {user}=useAuth();if(!user?.id||['disabled','suspended','banned'].includes(user.account_status))return null;return <Panel key={JSON.stringify([user.id,user.role,user.account_status])} user={user} onConfirmed={onConfirmed}/>;}
