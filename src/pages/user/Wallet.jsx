import React,{useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {useMemberWallet,formatWalletInteger} from '@/hooks/useMemberWallet';
import {pendingConversion,conversionInput,confirmedConversion,definitivePolicyChange} from '@/lib/xp-conversion-client';
import PageHeader from '@/components/perk/PageHeader';
import {Button} from '@/components/ui/button';

export default function Wallet(){
 const {user}=useAuth(),{wallet,refresh}=useMemberWallet();
 const [policyState,setPolicyState]=useState(null),[input,setInput]=useState(''),[notice,setNotice]=useState(null),[busy,setBusy]=useState(false),[policyLoading,setPolicyLoading]=useState(true),[pending,setPending]=useState(null),[recoveryBlocked,setRecoveryBlocked]=useState(false);
 const generation=useRef(0),lock=useRef(null),currentMember=useRef(user?.id);currentMember.current=user?.id;
 const policy=policyState?.member===user?.id?policyState.data:null;
 const message=notice?.member===user?.id?notice.text:'';
 const notify=(member,text)=>setNotice({member,text});
 const loadPolicy=useCallback(async()=>{
  const current=++generation.current,member=user?.id;
  if(!member){setPolicyState(null);setPolicyLoading(false);return;}
  setPolicyLoading(true);
  try{
   const response=await base44.functions.invoke('convertXp',{action:'policy'}),data=response.data?.data;
   if(!data||![data.version,data.input_xp,data.output_points].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('unavailable');
   if(current===generation.current&&member===currentMember.current)setPolicyState({member,data});
  }catch{if(current===generation.current&&member===currentMember.current)setPolicyState(null);}
  finally{if(current===generation.current&&member===currentMember.current)setPolicyLoading(false);}
 },[user?.id]);
 useEffect(()=>{
  const member=user?.id;lock.current=null;setBusy(false);setNotice(null);setPending(null);setInput('');setRecoveryBlocked(false);
  if(member)try{
   const saved=pendingConversion(sessionStorage.getItem('perksphere-xp-conversion:'+member));
   if(saved){setPending(saved);setInput(String(saved.xp));notify(member,'A previous conversion is awaiting confirmation. Retry it using the same request.');}
  }catch{setRecoveryBlocked(true);notify(member,'The saved conversion recovery details could not be read. Contact support before starting another conversion.');}
  loadPolicy();return ()=>{generation.current++;lock.current=null;};
 },[loadPolicy,user?.id]);
 async function convert(event){
  event.preventDefault();if(lock.current||!user?.id||!policy||recoveryBlocked)return;
  const member=user.id,token=Symbol('xp-conversion'),key='perksphere-xp-conversion:'+member;
  lock.current=token;setBusy(true);notify(member,'');
  const current=()=>lock.current===token&&currentMember.current===member;
  try{
   let request=pendingConversion(sessionStorage.getItem(key));
   if(request){if(Number(input)!==request.xp){notify(member,'Retry the original XP amount to confirm the previous request.');return;}}
   else{
    let amount;try{amount=conversionInput(input,policy);}catch{notify(member,'Enter a whole XP amount using the displayed increment.');return;}
    if(!globalThis.crypto?.randomUUID)throw Error('recovery_unavailable');
    request={action:'convert',request_reference:crypto.randomUUID(),xp:amount,policy_version:policy.version};
    // Persist before sending. Unknown outcomes always retain this exact identity.
    sessionStorage.setItem(key,JSON.stringify(request));setPending(request);
   }
   const response=await base44.functions.invoke('convertXp',request);
   if(!current())return;
   const data=response.data?.data;if(!confirmedConversion(data,request))throw Error('confirmation_unavailable');
   sessionStorage.removeItem(key);setPending(null);setInput('');
   notify(member,data.points_credited+' points added for '+data.xp_spent+' XP.');await refresh();
  }catch(error){
   if(!current())return;
   if(definitivePolicyChange(error)){
    sessionStorage.removeItem(key);setPending(null);
    notify(member,'The previous request was rejected because the rate changed. Review the current rate before submitting again.');await loadPolicy();
   }else if(error.message==='recovery_record_invalid'){
    setRecoveryBlocked(true);notify(member,'The saved conversion recovery details could not be read. Contact support before starting another conversion.');
   }else notify(member,'The conversion could not be confirmed. Retry the same request or contact support. No replacement request has been sent.');
  }finally{if(current()){lock.current=null;setBusy(false);}}
 }
 return <div className="space-y-6">
  <PageHeader title="Your wallet" description="View points and XP, and convert XP when available."/>
  <section className="rounded-2xl border p-5"><h2 className="font-semibold">Balances</h2><p>Points: {wallet?formatWalletInteger(wallet.points_balance):'Unavailable'}</p><p>XP: {wallet?formatWalletInteger(wallet.loyalty_xp):'Unavailable'}</p></section>
  <section className="rounded-2xl border p-5 space-y-3"><h2 className="font-semibold">Convert XP to points</h2>
   {policyLoading?<p role="status">Checking conversion availability…</p>:!policy?<><p>XP conversion is currently unavailable.</p><Button variant="outline" disabled={busy} onClick={loadPolicy}>Check availability</Button></>:<><p>{policy.input_xp} XP converts to {policy.output_points} points.</p><form onSubmit={convert} className="flex flex-wrap items-center gap-3"><label htmlFor="xp-amount">XP amount</label><input id="xp-amount" inputMode="numeric" type="number" min={pending?1:policy.input_xp} step={pending?1:policy.input_xp} value={input} onChange={e=>setInput(e.target.value)} disabled={busy||!!pending||recoveryBlocked} className="rounded border bg-background px-2 py-2"/><Button disabled={busy||recoveryBlocked} type="submit">{busy?'Processing…':pending?'Retry previous conversion':'Convert XP'}</Button></form></>}
   {message&&<p role="status">{message}</p>}
  </section>
  <section className="rounded-2xl border p-5"><h2 className="font-semibold">Money and gift cards</h2><p>Cash conversion, withdrawals and gift-card redemption are not available yet.</p></section>
 </div>;
}
