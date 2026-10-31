import React,{useEffect,useState,useRef} from 'react';
import {Link} from 'react-router-dom';
import {base44} from '@/api/base44Client';

export default function VerifiedStreakBonuses(props){
 return props.userId ? <MemberStreakBonuses key={props.userId} {...props} /> : null;
}
function MemberStreakBonuses({userId,tasks,refreshWallet}){
 const mounted=useRef(true),lock=useRef(null);
 const [campaigns,setCampaigns]=useState([]),[busy,setBusy]=useState(null),[messages,setMessages]=useState({});
 useEffect(()=>{
  let active=true;mounted.current=true;setCampaigns([]);setMessages({});
  if(userId)base44.functions.invoke('listVerifiedStreaks',{}).then(r=>{if(active&&Array.isArray(r.data?.data))setCampaigns(r.data.data);}).catch(()=>{});
  return()=>{active=false;mounted.current=false;lock.current=null;};
 },[userId]);
 async function claim(c,key){
  if(!mounted.current||lock.current)return;
  const token=Symbol('streak-claim');lock.current=token;
  const current=()=>mounted.current&&lock.current===token;
  setBusy(key);setMessages(m=>({...m,[key]:''}));
  try{
   const r=await base44.functions.invoke('claimVerifiedStreak',{account_reference:c.account_reference,campaign_reference:c.campaign_reference});
   if(!current())return;
   const d=r.data?.data;
   if(typeof d?.issued!=='boolean'||d.duplicate!==undefined&&typeof d.duplicate!=='boolean')throw Error('UNCONFIRMED_BONUS');
   let message;
   if(d.issued===true)message='Bonus added to your wallet.';
   else if(d?.duplicate===true)message='This bonus was already awarded today (UTC).';
   else if(d?.reason==='five_days_required')message='Complete a qualifying task on each of five consecutive UTC days, including today.';
   else if(d?.reason==='bonus_window_not_complete')message='The next five-day bonus window is not complete yet.';
   else message='This bonus is not currently available.';
   setMessages(m=>({...m,[key]:message}));
   if(d.issued===true||d.duplicate===true){
    try{if(await refreshWallet()===false&&current())setMessages(m=>({...m,[key]:message+' Refresh your wallet to update the displayed balance.'}));}
    catch{if(current())setMessages(m=>({...m,[key]:message+' Refresh your wallet to update the displayed balance.'}));}
   }
  }catch{if(current())setMessages(m=>({...m,[key]:'Could not check the bonus. Please try again later.'}));}
  finally{if(current()){lock.current=null;setBusy(null);}}
 }
 if(!campaigns.length)return null;
 return <section className="mb-4 rounded-2xl border border-border bg-card p-5">
  <h2 className="font-semibold">Xero Streams five-day bonuses</h2>
  <p className="mt-1 text-sm text-muted-foreground">Complete a qualifying video task on each of five consecutive UTC days, including today. Each task counts according to its own completion rules. Your verified Xero Streams account must remain linked.</p>
  <div className="mt-3 space-y-3">{campaigns.map((c,index)=>{
   const key=c.campaign_reference+':'+c.account_reference;
   const titles=c.task_references.map(id=>tasks.find(t=>t.id===id)?.name).filter(Boolean);
   return <div key={key} className="rounded-xl border p-3">
    <p className="font-medium">Bonus {index+1}: {c.points} points + {c.xp} XP</p>
    {titles.length>0&&<p className="text-sm">Qualifying tasks: {titles.join(', ')}{titles.length<c.task_references.length?' and more':''}</p>}
    <p className="text-xs text-muted-foreground">Activity counts from {c.activity_after.slice(0,10)} UTC. <Link className="underline" to="/tasks">View tasks</Link></p>
    <button type="button" disabled={busy!==null} onClick={()=>claim(c,key)} className="mt-2 rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">Check and claim</button>
    {messages[key]&&<p role="status" className="mt-2 text-sm">{messages[key]}</p>}
   </div>;
  })}</div>
 </section>;
}
