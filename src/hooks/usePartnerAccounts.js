import {useState,useRef,useEffect,useCallback} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
const EMPTY={partners:[],links:[],connected:[],verification:{},loadError:false,loading:true,refreshing:false};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const rows=value=>Array.isArray(value)&&value.every(row=>object(row)&&typeof row.id==='string');
export function usePartnerAccounts(toast,{writeClipboard=text=>navigator.clipboard.writeText(text)}={}){
 const {user}=useAuth(),member=user?.id?String(user.id):null;
 const identity=useRef({member}),generation=useRef(0),action=useRef(null),inFlight=useRef(null),mounted=useRef(true),copyTimer=useRef(null);
 if(identity.current.member!==member){identity.current={member};generation.current++;action.current=null;}
 const session=identity.current;
 const [snapshot,setSnapshot]=useState(EMPTY),[dialog,setDialog]=useState(null),[copiedState,setCopied]=useState(null),[busy,setBusy]=useState(null),[clock,setClock]=useState(Date.now());
 const owned=!!member&&snapshot.session===session,view=owned?snapshot:EMPTY;
 const current=()=>mounted.current&&identity.current===session;
 const load=useCallback(async()=>{
  if(!member||!mounted.current||identity.current!==session)return false;
  if(inFlight.current?.session===session)return inFlight.current.promise;
  const request=++generation.current,active=()=>mounted.current&&identity.current===session&&generation.current===request;
  setSnapshot(previous=>({...((previous.session===session)?previous:EMPTY),session,refreshing:true}));
  const promise=(async()=>{
   try{
    const [p,l]=await Promise.all([base44.functions.invoke('partnerAccountLink',{action:'listPartners'}),base44.functions.invoke('partnerAccountLink',{action:'listLinks'})]);
    const partners=p?.data,links=l?.data;
    if(partners?.ok!==true||links?.ok!==true||partners.user_reference!==member||links.user_reference!==member||!rows(partners.partners)||!rows(links.links)||!rows(links.connected)||!object(links.verification)||!Object.values(links.verification).every(value=>['verified','not_linked','unavailable'].includes(value)))throw Error('INVALID_LINK_STATE');
    if(active())setSnapshot({session,partners:partners.partners,links:links.links,connected:links.connected,verification:links.verification,loadError:false,loading:false,refreshing:false});
    return active();
   }catch{
    if(active())setSnapshot(previous=>({...((previous.session===session)?previous:EMPTY),session,verification:{},loadError:true,loading:false,refreshing:false}));
    return false;
   }
  })();
  inFlight.current={session,promise};
  try{return await promise;}finally{if(inFlight.current?.promise===promise)inFlight.current=null;}
 },[member,session]);
 useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;generation.current++;action.current=null;clearTimeout(copyTimer.current);};},[load]);
 const challengeDialog=member&&dialog?.session===session?dialog:null;
 const hasPending=owned&&view.links.some(link=>link.status==='pending'&&Number.isFinite(Date.parse(link.expires_at))&&Date.parse(link.expires_at)>clock);
 useEffect(()=>{if(!hasPending&&!challengeDialog)return;const timer=setInterval(load,5000);return()=>clearInterval(timer);},[hasPending,challengeDialog,load]);
 useEffect(()=>{if(!challengeDialog)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[challengeDialog]);
 useEffect(()=>{if(challengeDialog&&view.verification[challengeDialog.partner.id]==='verified')setDialog(previous=>previous===challengeDialog?null:previous);},[challengeDialog,view.verification]);
 const acquire=kind=>{
  if(!member||!current()||action.current)return null;
  const token={session,kind};action.current=token;setBusy(token);
  return {active:()=>current()&&action.current===token,release:()=>{if(action.current===token){action.current=null;setBusy(null);}}};
 };
 const fresh=async active=>{
  const pending=inFlight.current;if(pending?.session===session)await pending.promise;
  if(active())await load();
 };
 const startLink=async partner=>{
  const lock=acquire(partner.id);if(!lock)return;
  try{
   const response=await base44.functions.invoke('partnerAccountLink',{action:'createChallenge',partnerId:partner.id}),data=response?.data;
   if(!lock.active())return;
   if(data?.ok!==true||data.user_reference!==member||typeof data.challenge_token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.challenge_token)||typeof data.expires_at!=='string'||!Number.isFinite(Date.parse(data.expires_at))||Date.parse(data.expires_at)<=Date.now())throw Error('INVALID_CHALLENGE');
   setDialog({session,partner,challenge_token:data.challenge_token,expires_at:data.expires_at,instructions:typeof data.instructions==='string'?data.instructions:''});setCopied(null);setClock(Date.now());
   await fresh(lock.active);
  }catch{if(lock.active())toast({title:'Connection unavailable',description:'A linking challenge could not be confirmed. Refresh connections before trying again.',variant:'destructive'});}
  finally{lock.release();}
 };
 const unlink=async connId=>{
  const lock=acquire('unlink');if(!lock)return;
  try{
   const response=await base44.functions.invoke('partnerAccountLink',{action:'unlink',connectedServiceId:connId});
   if(!lock.active())return;
   if(response?.data?.ok!==true||response.data.user_reference!==member)throw Error('UNCONFIRMED_UNLINK');
   toast({title:'Account unlinked'});await fresh(lock.active);
  }catch{if(lock.active())toast({title:'Disconnect could not be confirmed',description:'Refresh connections before trying again. Your saved connection has not been removed from this view.',variant:'destructive'});}
  finally{lock.release();}
 };
 const copyChallenge=async()=>{
  const selected=challengeDialog;
  if(!selected||!current()||Date.parse(selected.expires_at)<=Date.now())return;
  try{
   await writeClipboard(selected.challenge_token);
   if(!current())return;
   const copied={session,token:selected.challenge_token};setCopied(copied);clearTimeout(copyTimer.current);
   copyTimer.current=setTimeout(()=>setCopied(previous=>previous===copied?null:previous),2000);
  }catch{if(current())toast({title:'Copy failed',variant:'destructive'});}
 };
 return {...view,loading:!!member&&(!owned||view.loading),load,startLink,unlink,copyChallenge,challengeDialog,
  closeChallenge:()=>setDialog(previous=>previous===challengeDialog?null:previous),
  copied:!!challengeDialog&&copiedState?.session===session&&copiedState.token===challengeDialog.challenge_token,
  linking:busy?.session===session?busy.kind:null,actionsBusy:!!busy&&busy.session===session,
  challengeExpired:!!challengeDialog&&Date.parse(challengeDialog.expires_at)<=clock};
}
