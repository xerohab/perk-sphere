import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
export function isTodayCheckIn(receipt,userId,now=Date.now()){
 return receipt?.member===userId&&receipt.day===new Date(now).toISOString().slice(0,10);
}
export default function DailyCheckIn({userId,refreshWallet,now=Date.now()}){
 const [availability,setAvailability]=useState(null),[receipt,setReceipt]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const member=useRef(userId),lock=useRef(null);member.current=userId;
 const today=new Date(now).toISOString().slice(0,10);
 useEffect(()=>{
  let active=true;lock.current=null;setReceipt(null);setError('');setBusy(false);setAvailability(null);
  if(userId)base44.functions.invoke('dailyLoginStatus',{}).then(response=>{
   if(!active||member.current!==userId)return;
   const d=response.data;
   if(d?.enabled!==true){setAvailability({member:userId,enabled:false});return;}
   if(d.user_reference!==String(userId)||typeof d.claimed!=='boolean'||typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day))throw Error('INVALID_STATUS');
   setAvailability({member:userId,enabled:true,penaltyEnabled:d.penalty_enabled===true});
   if(d.claimed)setReceipt({member:userId,day:d.day,duplicate:true});
   if(d.points_deducted>0)Promise.resolve(refreshWallet()).catch(()=>{});
  }).catch(()=>{if(active&&member.current===userId)setAvailability({member:userId,enabled:false});});
  return ()=>{active=false;lock.current=null;};
 },[userId,today]);
 if(availability?.member!==userId||availability.enabled!==true)return null;
 const complete=isTodayCheckIn(receipt,userId,now);
 async function claim(){
  if(lock.current||complete||!userId)return;const token=Symbol('daily-check-in');lock.current=token;setBusy(true);setError('');
  const current=()=>lock.current===token&&member.current===userId;
  try{
   const response=await base44.functions.invoke('claimDailyLogin',{}),data=response.data?.data;
   if(!current())return;
   if(data?.points!==1||typeof data.duplicate!=='boolean'||typeof data.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.day))throw Error();
   setReceipt({member:userId,day:data.day,duplicate:data.duplicate});
   try{if(await refreshWallet()===false&&current())setError('Check-in confirmed. Refresh your wallet to update the displayed balance.');}catch{if(current())setError('Check-in confirmed. Refresh your wallet to update the displayed balance.');}
  }catch{if(current())setError('Your check-in could not be confirmed. Retry to check the same daily reward.');}
  finally{if(current()){lock.current=null;setBusy(false);}}
 }
 return <section className="mb-4 rounded-xl border bg-card p-4 space-y-2" aria-label="Daily check-in">
  <h2 className="font-semibold">Daily check-in · +1 point</h2>
  <p className="text-sm text-muted-foreground">{availability.penaltyEnabled ? 'Claim 1 Point once each UTC day. Each full UTC day without a signed-in visit deducts 1 Point when you next return, down to a minimum balance of zero. Tracking starts from your first visit under this policy; earlier days are not charged.' : 'Claim 1 Point once each UTC day. Missed-day deductions are not currently enabled.'}</p>
  {complete?<p role="status" className="text-sm">{receipt.duplicate?'Your point was already earned today.':'1 point added for today.'} Come back after midnight UTC.</p>:<Button type="button" disabled={busy} onClick={claim}>{busy?'Checking…':'Claim daily point'}</Button>}
  {error&&<p role="status" className="text-sm">{error}</p>}
 </section>;
}
