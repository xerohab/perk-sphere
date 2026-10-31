import {useEffect} from 'react';
import {base44} from '@/api/base44Client';
export function useDailyAttendance(userId){
 useEffect(()=>{
  if(!userId)return;
  let active=true,inFlight=false,confirmedDay=null;
  const record=async()=>{
   const day=new Date().toISOString().slice(0,10);
   if(!active||inFlight||document.hidden||confirmedDay===day)return;
   inFlight=true;
   try{
    const response=await base44.functions.invoke('dailyLoginStatus',{}),d=response.data;
    if(!active||d?.enabled!==true||d.user_reference!==String(userId)||d.day!==day)return;
    confirmedDay=d.day;
    if(d.points_deducted>0)window.dispatchEvent(new CustomEvent('perksphere-wallet-refresh',{detail:{member:String(userId)}}));
   }catch{/* Retry when visible; never block sign-in on reward availability. */}
   finally{inFlight=false;}
  };
  record();
  const timer=setInterval(record,60000);
  document.addEventListener('visibilitychange',record);
  window.addEventListener('focus',record);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',record);window.removeEventListener('focus',record);};
 },[userId]);
}
