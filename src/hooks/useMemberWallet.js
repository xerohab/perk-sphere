import {useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
export function useMemberWallet(){
 const {user}=useAuth();const [wallet,setWallet]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const generation=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setWallet(null);setError('');
  try{const result=await base44.functions.invoke('getMemberWallet',{});const data=result.data?.data;if(!result.data?.ok||!data||!['legacy','linux'].includes(data.source))throw Error('wallet_unavailable');if(current===generation.current)setWallet(data);}
  catch{if(current===generation.current)setError('Your balance and history are temporarily unavailable. Please retry.');}
  finally{if(current===generation.current)setLoading(false);}
 },[user?.id]);
 useEffect(()=>{refresh();return()=>{generation.current++;};},[refresh]);
 return {wallet,error,loading,refresh};
}
export function formatWalletInteger(value){return value==null?'Unavailable':BigInt(value).toLocaleString();}
export function rankXp(value){return value==null?0:Number(BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):BigInt(value));}
