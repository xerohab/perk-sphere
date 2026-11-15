import React,{useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {giftMemberCheckoutRequest,projectGiftMemberCheckoutResult} from '../../../base44/shared/giftMemberCheckoutContract.ts';
// Checkout supplies the selected offer and its recipient fields. Nothing is saved automatically.
export default function GiftMemberConfirmation({offerReference,fields}){
 const {user}=useAuth(),key=JSON.stringify([user?.id,user?.role,user?.account_status,offerReference,fields]);
 const current=useRef(key);current.current=key;
 const mounted=useRef(true),lock=useRef(null),pending=useRef(null);
 const [record,setRecord]=useState(null),[country,setCountry]=useState(''),[region,setRegion]=useState(''),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{lock.current=null;pending.current=null;setRecord(null);setCountry('');setRegion('');setApproved(false);setBusy(false);setMessage('');},[key]);
 const own=record?.key===key?record:null,uncertain=pending.current?.key===key;
 async function send(operation){
  if(!mounted.current||lock.current||current.current!==key||!user?.id||!['user','admin'].includes(user.role)||['banned','disabled','suspended'].includes(user.account_status))return;
  let command;
  try{
   if(pending.current?.key===key)command=pending.current.command;
   else if(operation==='read')command=giftMemberCheckoutRequest({action:'confirmation',operation,offerReference,fields});
   else{if(!own)throw Error();command=giftMemberCheckoutRequest({action:'confirmation',operation:'revise',offerReference,fields,requestReference:crypto.randomUUID(),expectedVersion:own.version,country:country.trim().toUpperCase(),region:region.trim()||null,approved});pending.current={key,command};}
  }catch{setMessage('Load your current confirmation and enter a two-letter country code.');return;}
  const token={};lock.current=token;setBusy(true);setMessage('');
  try{
   const response=await base44.functions.invoke('giftMemberCheckout',command),result=projectGiftMemberCheckoutResult({ok:true,productionReady:false,data:response.data?.data},command);
   if(!mounted.current||current.current!==key||lock.current!==token)return;
   pending.current=null;setRecord({key,...result});
   if(command.operation==='read'){setCountry(result.country||'');setRegion(result.region||'');setApproved(result.approved);setMessage(result.found?'Your current declaration is loaded.':'No declaration is saved for these details.');}
   else setMessage(result.approved?'Your self-declared details are saved.':'Your approval has been withdrawn.');
  }catch{if(mounted.current&&current.current===key&&lock.current===token)setMessage(command.operation==='revise'?'The save could not be confirmed. Retry the same request before changing your details.':'Your confirmation could not be loaded. Please retry.');}
  finally{if(lock.current===token){lock.current=null;if(mounted.current&&current.current===key)setBusy(false);}}
 }
 if(!user?.id||!['user','admin'].includes(user.role)||['banned','disabled','suspended'].includes(user.account_status))return <p role="status">Sign in to confirm your details.</p>;
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Buyer confirmation">
  <h2 className="font-semibold">Confirm your details</h2>
  <p className="text-sm text-muted-foreground">You declare your country and confirm the recipient details entered for this offer. These details are self-declared and have not been independently verified.</p>
  {!own&&!uncertain?<button type="button" disabled={busy} onClick={()=>send('read')}>Load current confirmation</button>:<>
   <label className="block">Country code<input className="ml-2 rounded border p-2" value={country} maxLength={2} placeholder="GB" disabled={busy||uncertain} onChange={e=>setCountry(e.target.value)}/></label>
   <label className="block">Region (optional)<input className="ml-2 rounded border p-2" value={region} maxLength={64} disabled={busy||uncertain} onChange={e=>setRegion(e.target.value)}/></label>
   <label className="block"><input type="checkbox" checked={approved} disabled={busy||uncertain} onChange={e=>setApproved(e.target.checked)}/> I confirm that my country and the recipient details for this offer are correct.</label>
   <button type="button" disabled={busy} onClick={()=>send('revise')}>{busy?'Saving…':uncertain?'Retry original save':approved?'Save confirmation':'Save withdrawal'}</button>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
