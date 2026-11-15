import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {paypalPayoutCommand,projectPaypalPayoutResponse} from '../../../base44/shared/paypalPayoutContract.ts';
import {formatGbpPence} from '../../../base44/shared/memberCashWalletContract.ts';
export function payoutPence(text){if(typeof text!=='string'||!/^(0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(text))throw Error();const [whole,fraction='']=text.split('.');return (BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))).toString();}
export default function PaypalPayoutPanel({admin=false}){
 const {user}=useAuth(),allowed=!!user?.id&&['user','admin'].includes(user.role)&&!['disabled','banned','suspended'].includes(user.account_status)&&(!admin||user.role==='admin');
 const scope=JSON.stringify([user?.id,user?.role,user?.account_status,admin,allowed]),current=useRef(scope);current.current=scope;
 const mounted=useRef(true),token=useRef(null),saved=useRef(null),generation=useRef(0);
 const [report,setReport]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[pending,setPending]=useState(null),[blocked,setBlocked]=useState(false),[amount,setAmount]=useState('50.00'),[email,setEmail]=useState(''),[consent,setConsent]=useState(false),[reason,setReason]=useState(''),[transaction,setTransaction]=useState('');
 const storageKey='perksphere-paypal-payout:'+user?.id+':'+(admin?'staff':'member');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 useEffect(()=>{generation.current++;token.current=null;saved.current=null;setReport(null);setNotice('');setPending(null);setBlocked(false);setBusy(false);setEmail('');setConsent(false);setReason('');setTransaction('');
  if(!allowed)return;
  try{const raw=sessionStorage.getItem(storageKey);if(raw){const value=JSON.parse(raw);if(value.member!==user.id||value.admin!==admin)throw Error();const command=paypalPayoutCommand(value.command,admin);if(command.action==='list')throw Error();saved.current=command;setPending(command);setNotice('An earlier request needs confirmation. Retry the original request.');}}
  catch{setBlocked(true);setNotice('Saved request details could not be read. Contact support before submitting another request.');}
 },[scope,storageKey,allowed,user?.id,admin]);
 async function run(input){
  if(!allowed||!mounted.current||current.current!==scope||token.current)return;
  let command;try{command=paypalPayoutCommand(input,admin);if(command.action!=='list'){
   if(blocked)throw Error();
   if(saved.current){if(JSON.stringify(command)!==JSON.stringify(saved.current))throw Error();}
   else{const recovery={member:user.id,admin,command};sessionStorage.setItem(storageKey,JSON.stringify(recovery));if(sessionStorage.getItem(storageKey)!==JSON.stringify(recovery))throw Error();saved.current=command;setPending(command);}
  }}catch{setNotice('Check the amount, email and confirmation. Preserve any pending request and retry it unchanged.');return;}
  const mark={},epoch=++generation.current;token.current=mark;setBusy(true);setNotice('');const live=()=>mounted.current&&current.current===scope&&token.current===mark&&generation.current===epoch;
  try{
   const response=await base44.functions.invoke(admin?'managePaypalPayouts':'paypalPayouts',command);if(!live())return;const data=response.data?.data;
   if(command.action==='list'&&data?.enabled===false){setReport({scope,enabled:false});return;}
   if(data?.enabled!==true)throw Error();const {enabled,...body}=data,result=projectPaypalPayoutResponse(body,command,admin);
   if(!live())return;
   if(command.action==='list')setReport({scope,enabled,...result});
   else{
    try{sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null)throw Error();saved.current=null;setPending(null);}
    catch{setBlocked(true);setNotice('The request is confirmed, but recovery storage could not be cleared. Contact support before another request.');return;}
    setReport(old=>old?.scope===scope?{...old,items:[result.request,...(old.items||[]).filter(r=>r.payout_uuid!==result.request.payout_uuid)].slice(0,25)}:{scope,enabled:true,items:[result.request],has_more:false});
    setNotice(command.action==='submit'?'Request received. The amount is reserved until it is paid or cancelled.':command.action==='sent'?'Payment recorded as sent by staff.':'Request status updated.');setConsent(false);setTransaction('');setReason('');
   }
  }catch(error){if(live()){
   if(command.action==='submit'&&error?.response?.status===409&&error.response.data?.error==='PAYOUT_INSUFFICIENT_FUNDS'){
    try{sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null)throw Error();saved.current=null;setPending(null);setNotice('Your available GBP balance is too low for this request. No amount was reserved.');}
    catch{setBlocked(true);setNotice('The request was rejected, but recovery details could not be cleared. Contact support.');}
   }else setNotice(command.action==='list'?'Payout information could not be loaded.':'The result could not be confirmed. Retry the original request; do not send a replacement payment.');
  }}
  finally{if(token.current===mark){token.current=null;if(mounted.current&&current.current===scope)setBusy(false);}}
 }
 const data=report?.scope===scope?report:null,locked=busy||!!pending||blocked;
 if(!allowed)return null;
 function submit(e){e.preventDefault();if(!consent)return;try{run({action:'submit',request_reference:crypto.randomUUID(),amount_pence:payoutPence(amount),paypal_email:email.trim().toLowerCase()});}catch{setNotice('Enter a valid amount of at least £50.');}}
 function change(row,action){if(!admin&&action==='cancel'&&!window.confirm('Cancel this unpaid request and release its reserved balance?'))return;
  if(action==='sent'&&!window.confirm('Confirm you have already sent the exact amount to this PayPal email and checked its completed PayPal transaction. This records payment; it does not send one.'))return;
  run({action,payout_uuid:row.payout_uuid,expected_version:row.version,reason:action==='cancel'?'Member cancelled unpaid request':reason,...(admin?{user_reference:row.user_reference}:{}),...(action==='sent'?{amount_pence:row.amount_pence,paypal_email:row.paypal_email,paypal_transaction_id:transaction.trim().toUpperCase()}:{})});
 }
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={admin?'PayPal payout queue':'PayPal withdrawals'}>
  <h2 className="font-semibold">{admin?'PayPal payout queue':'PayPal withdrawals'}</h2>
  <p className="text-sm">Minimum £50. We aim to send approved requests within 24 hours of submission. PayPal processing and account checks may delay receipt. Payments are processed manually.</p>
  <button className="rounded border px-3 py-2" disabled={busy} onClick={()=>run({action:'list',limit:25,offset:0})}>Check requests</button>
  {data?.enabled===false&&<p role="status">PayPal withdrawal requests are not open yet.</p>}
  {pending&&<div className="rounded border p-3"><p>An earlier {pending.action} request is awaiting confirmation. Its original amount and destination are locked.</p><button disabled={busy||blocked} onClick={()=>run(pending)}>Retry original request</button></div>}
  {data?.enabled&&!admin&&<form onSubmit={submit} className="space-y-3"><label className="block">Amount in GBP<input className="ml-2 rounded border p-2" inputMode="decimal" value={amount} disabled={locked} onChange={e=>setAmount(e.target.value)}/></label><label className="block">PayPal email<input className="ml-2 rounded border p-2" type="email" autoComplete="email" value={email} disabled={locked} onChange={e=>setEmail(e.target.value)} required/></label><label className="block"><input type="checkbox" checked={consent} disabled={locked} onChange={e=>setConsent(e.target.checked)}/> I confirm this PayPal email is correct and authorize reserving this amount. Request recovery details are kept in this browser tab’s session.</label><button className="rounded border px-3 py-2" disabled={locked||!consent} type="submit">Request PayPal withdrawal</button></form>}
  {data?.enabled&&admin&&<div className="space-y-3"><p className="text-sm">Claim a request before paying it in PayPal. Only the staff member who claimed it can record it as sent. Never send again because a screen timed out; reconcile the original payment first.</p><label className="block">Review note<input className="ml-2 rounded border p-2" value={reason} maxLength={1000} disabled={locked} onChange={e=>setReason(e.target.value)}/></label><label className="block">Completed PayPal transaction ID<input className="ml-2 rounded border p-2" value={transaction} maxLength={17} disabled={locked} onChange={e=>setTransaction(e.target.value)}/></label></div>}
  {data?.enabled&&<div className="space-y-3">{(data.items||[]).length===0?<p>No requests found.</p>:(data.items||[]).map(row=><article key={row.payout_uuid} className="space-y-1 rounded border p-3"><p className="font-medium">{formatGbpPence(row.amount_pence)} · {row.status==='sent'?'Sent — recorded by staff':row.status}</p><p className="break-all">{row.paypal_email}</p><p className="text-xs">Reference: {row.payout_uuid}</p>{admin&&<p className="text-xs">Member: {row.user_reference}</p>}<p className="text-sm">Submitted {new Date(row.created_at).toLocaleString()} · Target {new Date(row.due_at).toLocaleString()}</p>{['requested','processing'].includes(row.status)&&Date.parse(row.due_at)<Date.now()&&<p className="text-amber-700">Overdue — staff follow-up required</p>}{row.paypal_transaction_id&&<p className="text-xs">PayPal transaction: {row.paypal_transaction_id}</p>}{row.status==='requested'&&(admin?<div className="flex gap-3"><button disabled={locked} onClick={()=>change(row,'claim')}>Claim for payment</button><button disabled={locked} onClick={()=>change(row,'reject')}>Reject and release</button></div>:<button disabled={locked} onClick={()=>change(row,'cancel')}>Cancel unpaid request</button>)}{admin&&row.status==='processing'&&row.processing_actor===user.id&&<button disabled={locked} onClick={()=>change(row,'sent')}>Record completed PayPal payment</button>}</article>)}<div className="flex gap-3">{data.offset>0&&<button disabled={busy} onClick={()=>run({action:'list',limit:25,offset:Math.max(0,data.offset-25)})}>Previous requests</button>}{data.has_more&&<button disabled={busy||data.offset>=10000} onClick={()=>run({action:'list',limit:25,offset:data.offset+25})}>More requests</button>}</div></div>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
