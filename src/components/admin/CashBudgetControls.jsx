import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {Button} from '@/components/ui/button';
import {cashBudgetPence,projectCashBudgetRead} from '../../../base44/shared/cashBudgetContract.ts';
const money=p=>{const n=BigInt(p);return '£'+String(n/100n)+'.'+String(n%100n).padStart(2,'0');};
function BudgetForm(){
 const [snapshot,setSnapshot]=useState(null),[limit,setLimit]=useState(''),[reserve,setReserve]=useState(''),[reason,setReason]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true),lock=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function load(offset=0){
  if(!mounted.current||lock.current)return;lock.current=true;setBusy(true);setSnapshot(null);setMessage('');
  try{
   const r=await base44.functions.invoke('manageCashBudget',{action:'read',limit:10,offset}),data=projectCashBudgetRead(r.data?.data,{limit:10,offset});
   if(!mounted.current)return;setSnapshot(data);setLimit(data.budget?.approved_limit_pence||'');setReserve(data.budget?.reserve_reference||'');setEnabled(data.budget?.enabled||false);setReason('');
  }catch{if(mounted.current)setMessage('Budget administration is paused or unavailable. Rules-management permission is required. No approval was changed.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(!mounted.current||lock.current||!snapshot)return;
  try{if(cashBudgetPence(limit)===0n||!/^[A-Za-z0-9_:@.-]{1,191}$/.test(reserve.trim())||reason.trim().length<5||reason.length>1000)throw Error();}catch{setMessage('Enter a positive whole-pence limit, an opaque reserve reference and a reason of 5–1,000 characters.');return;}
  lock.current=true;setBusy(true);setMessage('');
  try{
   const r=await base44.functions.invoke('manageCashBudget',{action:'update',expected_version:snapshot.budget?.version||0,enabled:snapshot.configured?enabled:false,approved_limit_pence:limit,reserve_reference:reserve.trim(),reason:reason.trim()});
   if(r.data?.data?.updated!==true||r.data.data.provider_funding_verified!==false||r.data.data.member_gate_changed!==false||r.data.data.payout_sent!==false)throw Error();
   if(mounted.current){setSnapshot(null);setMessage('Budget approval saved with an audit record. Funding was not verified and no member or payout gate changed. Reload to inspect the new version.');}
  }catch{if(mounted.current){setSnapshot(null);setMessage('The approval update could not be confirmed. Reload before retrying. Existing cash liabilities may require reconciliation or a higher ceiling.');}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="rounded-xl border bg-card p-5 space-y-4">
  <h2 className="font-semibold">Cash issuance budget</h2>
  <p className="text-sm text-muted-foreground">This cap limits new cash liability. Operator approval does not verify bank or provider funding. Member cash and payouts remain disabled. No default reserve is supplied.</p>
  <Button variant="outline" disabled={busy} onClick={()=>load(0)}>{busy?'Working…':'Check budget administration'}</Button>
  {snapshot&&<>
   <p className="text-sm">{snapshot.configured?'Version '+snapshot.budget.version+' · '+(snapshot.budget.enabled?'issuance cap enabled':'issuance cap paused'):'No issuance budget configured. Its first approval must be disabled.'}</p>
   {snapshot.budget&&<dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt>Approved ceiling</dt><dd className="break-all font-medium">{money(snapshot.budget.approved_limit_pence)}</dd></div><div><dt>Allocated liability</dt><dd className="break-all font-medium">{money(snapshot.budget.allocated_pence)}</dd></div><div><dt>Remaining capacity</dt><dd className="break-all font-medium">{money(snapshot.remaining_pence)}</dd></div></dl>}
   <form onSubmit={save} className="space-y-3">
    <label className="block text-sm">Approved ceiling in GBP pence<input required inputMode="numeric" value={limit} disabled={busy} onChange={e=>setLimit(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/><span className="text-xs text-muted-foreground">5,000 pence = £50.00. The ceiling cannot be below already allocated liability.</span></label>
    <label className="block text-sm">Opaque reserve evidence reference<input required maxLength={191} value={reserve} disabled={busy} onChange={e=>setReserve(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/><span className="text-xs text-muted-foreground">Use an internal evidence tag; do not enter credentials or banking details.</span></label>
    <label className="block text-sm">Approval reason<textarea required minLength={5} maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={busy||!snapshot.configured} onChange={e=>setEnabled(e.target.checked)}/>Enable the issuance cap after independent reserve review; member gates remain separate</label>
    <Button type="submit" disabled={busy}>{busy?'Saving…':'Save budget approval'}</Button>
   </form>
   <div className="space-y-2"><h3 className="text-sm font-semibold">Approval audit history</h3>{snapshot.history.length===0?<p className="text-sm">No approval records on this page.</p>:<ol className="space-y-3">{snapshot.history.map(row=><li key={row.audit_uuid} className="rounded border p-3 text-sm space-y-1"><p>Version {row.after.version} · {money(row.after.approved_limit_pence)} · {row.after.enabled?'enabled':'paused'}</p><p>{row.reason}</p><p className="break-all text-xs text-muted-foreground">{row.actor_reference} · {new Date(row.created_at).toLocaleString()}</p></li>)}</ol>}<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy||snapshot.offset===0} onClick={()=>load(Math.max(0,snapshot.offset-10))}>Newer approvals</Button><Button variant="outline" disabled={busy||!snapshot.has_more||snapshot.offset>=10000} onClick={()=>load(Math.min(10000,snapshot.offset+10))}>Older approvals</Button></div><p className="text-xs text-muted-foreground">Each page is a separate current snapshot. New approvals can move records between pages.</p></div>
  </>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
export default function CashBudgetControls(){const {user}=useAuth();return user?.id?<BudgetForm key={'cash-budget:'+user.id}/>:null;}
