import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {readMemberCashWallet,formatGbpPence} from '@/lib/member-cash-wallet-client';
const labels={points_conversion:'Points converted to GBP accounting balance',withdrawal_hold:'Internal withdrawal hold — no payment',withdrawal_release:'Internal hold released — no payment'};
function Panel({user}){
 const [visible,setVisible]=useState(false),[data,setData]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const mounted=useRef(false),generation=useRef(0),running=useRef(false);
 const load=useCallback(async(offset=0)=>{
  if(running.current)return;running.current=true;setBusy(true);setNotice('');const current=++generation.current,isCurrent=()=>mounted.current&&current===generation.current;
  try{const r=await readMemberCashWallet({base44,actorId:user.id,body:{limit:20,offset},isCurrent});if(isCurrent()){setVisible(r.enabled);setData(r.enabled?r:null);}}
  catch{if(isCurrent()){setData(null);setNotice('The accounting record could not be confirmed. Refresh to check the current account.');}}
  finally{if(isCurrent()){running.current=false;setBusy(false);}}
 },[user.id]);
 useEffect(()=>{mounted.current=true;load();const clear=()=>{generation.current++;running.current=false;setBusy(false);setData(null);setNotice('Refresh to load a current accounting record.');};window.addEventListener('focus',clear);document.addEventListener('visibilitychange',clear);return()=>{mounted.current=false;generation.current++;running.current=false;window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',clear);};},[load]);
 if(!visible)return null;
 return <section className="rounded-2xl border p-5 space-y-4" aria-labelledby="cash-record-heading">
  <h2 id="cash-record-heading" className="font-semibold">GBP accounting record</h2>
  <p className="text-sm">This read-only record does not submit a conversion or payment. Withdrawals, payouts, gift cards and top-ups are unavailable.</p>
  <Button variant="outline" disabled={busy} onClick={()=>load(0)}>{busy?'Checking…':'Refresh cash record'}</Button>
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {data&&<>
   <dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Recorded total</dt><dd className="font-semibold">{formatGbpPence(data.balance_pence)}</dd></div><div><dt className="text-sm text-muted-foreground">Reserved internally</dt><dd className="font-semibold">{formatGbpPence(data.reserved_pence)}</dd></div><div><dt className="text-sm text-muted-foreground">Unreserved balance</dt><dd className="font-semibold">{formatGbpPence(data.available_pence)}</dd></div></dl>
   <p className="text-sm">The planned withdrawal threshold is {formatGbpPence(data.withdrawal_threshold_pence)}. Reaching it does not enable withdrawals or confirm provider funding.</p>
   {data.cash_actions_blocked&&<p role="status" className="text-sm">This account requires cash review. This view does not clear a review or release funds.</p>}
   <h3 className="font-medium">Recorded activity</h3>
   {data.history.length===0?<p className="text-sm">No recorded cash activity.</p>:<ol className="space-y-3">{data.history.map(row=><li key={row.operation_uuid} className="rounded border p-3 text-sm space-y-1"><p className="font-medium">{labels[row.operation_type]}</p><p>Balance change: {formatGbpPence(row.balance_delta_pence)} · Reserve change: {formatGbpPence(row.reserve_delta_pence)}</p>{row.points_spent!=='0'&&<p>Points spent: {BigInt(row.points_spent).toLocaleString('en-GB')}</p>}<time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></li>)}</ol>}
   <div className="flex flex-wrap gap-2">{data.offset>0&&<Button variant="outline" disabled={busy} onClick={()=>load(Math.max(0,data.offset-20))}>Newer records</Button>}{data.has_more&&data.offset+20<=10000&&<Button variant="outline" disabled={busy} onClick={()=>load(data.offset+20)}>Older records</Button>}</div>
   <p className="text-xs text-muted-foreground">Activity may change between pages. Refresh returns the newest records. An internal hold or release is not a bank payment.</p>
  </>}
 </section>;
}
export default function MemberCashWallet(){const {user}=useAuth();if(!user?.id||['disabled','suspended','banned'].includes(user.account_status))return null;return <Panel key={JSON.stringify([user.id,user.role,user.account_status])} user={user}/>;}
