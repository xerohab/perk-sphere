import React, {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {useMemberWallet,formatWalletInteger} from '@/hooks/useMemberWallet';
import PageHeader from '@/components/perk/PageHeader';

export default function Wallet(){
 const {user}=useAuth(),{wallet,refresh}=useMemberWallet(),[policy,setPolicy]=useState(null),[input,setInput]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 useEffect(()=>{let active=true;(async()=>{try{const r=await base44.functions.invoke('convertXp',{action:'policy'});if(active)setPolicy(r.data?.data||null);}catch{if(active)setPolicy(null);}})();return()=>{active=false;};},[user?.id]);
 async function convert(event){
  event.preventDefault();if(lock.current||!user?.id||!policy)return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const key='perksphere-xp-conversion:'+user.id;
   let pending=JSON.parse(sessionStorage.getItem(key)||'null');
   const amount=Number(input);
   if(pending){
    if(amount!==pending.xp){setMessage('A previous conversion is awaiting confirmation. Retry the same XP amount.');return;}
   }else{
    if(!Number.isSafeInteger(amount)||amount<=0||amount%policy.input_xp!==0){setMessage('Enter a valid XP amount using the displayed increment.');return;}
    if(!globalThis.crypto?.randomUUID)throw Error('secure identifier unavailable');
    pending={action:'convert',request_reference:crypto.randomUUID(),xp:amount,policy_version:policy.version};
    sessionStorage.setItem(key,JSON.stringify(pending));
   }
   const response=await base44.functions.invoke('convertXp',pending),data=response.data?.data;
   if(!data||typeof data.duplicate!=='boolean'||!/^[0-9]+$/.test(data.points_credited||'')||!/^[0-9]+$/.test(data.xp_spent||''))throw Error('confirmation unavailable');
   sessionStorage.removeItem(key);setMessage(data.points_credited+' points added for '+data.xp_spent+' XP.');await refresh();
  }catch{setMessage('The conversion could not be confirmed. Retry the same amount or contact support.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <div className="space-y-6">
  <PageHeader title="Your wallet" description="View points and XP, and convert XP when available."/>
  <section className="rounded-2xl border p-5"><h2 className="font-semibold">Balances</h2><p>Points: {wallet?formatWalletInteger(wallet.points_balance):'Unavailable'}</p><p>XP: {wallet?formatWalletInteger(wallet.loyalty_xp):'Unavailable'}</p></section>
  <section className="rounded-2xl border p-5 space-y-3"><h2 className="font-semibold">Convert XP to points</h2>
   {!policy?<p>XP conversion is currently unavailable.</p>:<><p>{policy.input_xp} XP converts to {policy.output_points} points.</p><form onSubmit={convert} className="flex flex-wrap gap-3"><label htmlFor="xp-amount">XP amount</label><input id="xp-amount" inputMode="numeric" type="number" min={policy.input_xp} step={policy.input_xp} value={input} onChange={e=>setInput(e.target.value)} disabled={busy} className="rounded border bg-transparent px-2"/><button disabled={busy} type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy?'Processing…':'Convert XP'}</button></form></>}
   {message&&<p role="status">{message}</p>}
  </section>
  <section className="rounded-2xl border p-5"><h2 className="font-semibold">Money and gift cards</h2><p>Cash conversion, withdrawals and gift-card redemption are not available yet.</p></section>
 </div>;
}
