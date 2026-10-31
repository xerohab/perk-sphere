import {useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
export function useMemberWallet(){
 const {user}=useAuth(),member=user?.id?String(user.id):null;
 const [state,setState]=useState({member:null,wallet:null,error:'',loading:false});
 const generation=useRef(0),currentMember=useRef(member);
 // Hide old state before effects run; invalidate even an A → B → A switch.
 if(currentMember.current!==member){currentMember.current=member;generation.current++;}
 const refresh=useCallback(async()=>{
  if(currentMember.current!==member)return false;
  const current=++generation.current;
  if(!member){setState({member:null,wallet:null,error:'',loading:false});return false;}
  setState({member,wallet:null,error:'',loading:true});
  const active=()=>current===generation.current&&currentMember.current===member;
  try{
   const result=await base44.functions.invoke('getMemberWallet',{}),data=result.data?.data;
   if(result.data?.ok!==true||!data||data.user_reference!==member||!['legacy','linux'].includes(data.source))throw Error('wallet_unavailable');
   if(active())setState({member,wallet:data,error:'',loading:false});
   return active();
  }catch{
   if(active())setState({member,wallet:null,error:'Your balance and history are temporarily unavailable. Please retry.',loading:false});
   return false;
  }
 },[member]);
 useEffect(()=>{refresh();return()=>{generation.current++;};},[refresh]);
 const owned=!!member&&state.member===member;
 return {wallet:owned?state.wallet:null,error:owned?state.error:'',loading:!!member&&(!owned||state.loading),refresh};
}
export function formatWalletInteger(value){return value==null?'Unavailable':BigInt(value).toLocaleString();}
export function rankXp(value){return value==null?0:Number(BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):BigInt(value));}
