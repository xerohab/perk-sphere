import React,{useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/lib/AuthContext';
import {giftVoucherRequest,projectGiftVoucherResult} from '../../../base44/shared/giftVoucherContract.ts';
export default function GiftVoucherReveal({intentUuid}){
 const {user}=useAuth(),scopeKey=JSON.stringify([user?.id,user?.role,user?.account_status,intentUuid]);
 const [revealed,setReceipt]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const receipt=revealed?.scopeKey===scopeKey?revealed.voucher:null;
 const currentScope=useRef(scopeKey);currentScope.current=scopeKey;
 const mounted=useRef(true),epoch=useRef(0),lock=useRef(null),request=useRef(null),visible=useRef(false);
 const hide=useCallback(()=>{
  const hadReveal=visible.current||lock.current!==null;epoch.current++;lock.current=null;request.current=null;visible.current=false;
  if(mounted.current){setReceipt(null);setBusy(false);if(hadReveal)setMessage('Voucher hidden. Reveal it again when ready.');}
 },[]);
 useEffect(()=>{mounted.current=true;const visibility=()=>{if(document.visibilityState!=='visible')hide();};window.addEventListener('blur',hide);document.addEventListener('visibilitychange',visibility);
  return()=>{mounted.current=false;epoch.current++;lock.current=null;request.current=null;visible.current=false;window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility);};
 },[hide]);
 useEffect(()=>{hide();},[scopeKey,hide]);
 useEffect(()=>{if(!receipt)return;const expiry=receipt.expiresAt===null?60000:Math.max(0,Date.parse(receipt.expiresAt)-Date.now());const timer=setTimeout(hide,Math.min(60000,expiry));return()=>clearTimeout(timer);},[receipt,hide]);
 async function reveal(){
  if(!mounted.current||lock.current!==null||currentScope.current!==scopeKey||!user?.id||['disabled','banned','suspended'].includes(user.account_status))return;
  let command;try{if(!request.current)request.current=crypto.randomUUID();command=giftVoucherRequest({intentUuid,requestReference:request.current});}catch{setMessage('This voucher cannot be opened.');return;}
  const current=++epoch.current;lock.current=current;setBusy(true);setReceipt(null);setMessage('');
  try{
   const response=await base44.functions.invoke('revealGiftVoucher',command),result=projectGiftVoucherResult(response.data,command);
   if(!mounted.current||epoch.current!==current||currentScope.current!==scopeKey)return;
   if(result.voucher.expiresAt!==null&&Date.parse(result.voucher.expiresAt)<=Date.now())throw Error();
   visible.current=true;setReceipt({scopeKey,voucher:result.voucher});
  }catch{if(mounted.current&&epoch.current===current)setMessage('The voucher could not be revealed. Retry or contact support.');}
  finally{if(lock.current===current)lock.current=null;if(mounted.current&&epoch.current===current)setBusy(false);}
 }
 if(!user?.id||['disabled','banned','suspended'].includes(user.account_status))return <p role="status">Voucher unavailable.</p>;
 const amount=receipt?((BigInt(receipt.faceValueMinor)/100n).toString()+'.'+(BigInt(receipt.faceValueMinor)%100n).toString().padStart(2,'0')):null;
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Gift voucher">
  <h2 className="font-semibold">Your gift voucher</h2>
  <p className="text-sm text-muted-foreground">Reveal your voucher when you are ready to use it. It hides when you leave this page or after one minute.</p>
  {!receipt?<Button type="button" disabled={busy} onClick={reveal}>{busy?'Revealing…':'Reveal voucher'}</Button>:<>
   <p className="font-medium">{receipt.currency} {amount}</p>
   <div><h3 className="text-sm font-medium">Voucher code</h3><p className="mt-2 break-all select-all rounded border p-3 font-mono">{receipt.code}</p></div>
   {receipt.instructions&&<p className="whitespace-pre-wrap break-words text-sm">{receipt.instructions}</p>}
   {receipt.expiresAt&&<p className="text-sm">Expires {new Date(receipt.expiresAt).toLocaleString()}</p>}
   {receipt.redemptionUrl&&<a className="inline-block underline" href={receipt.redemptionUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Redeem on {new URL(receipt.redemptionUrl).hostname}</a>}
   <div><Button type="button" variant="outline" onClick={hide}>Hide voucher</Button></div>
  </>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
