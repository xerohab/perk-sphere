import {useState,useRef,useEffect,useCallback} from 'react';
import {base44} from '@/api/base44Client';
import {loadDashboardData} from '@/lib/dashboard-data';
const EMPTY={levels:[],activities:[],rewards:[],achievements:[],tasks:[],taskProgress:[],sectionErrors:[]};
export function useDashboardData(userId){
 const member=userId?String(userId):null;
 const identity=useRef({member}),generation=useRef(0),mounted=useRef(true);
 if(identity.current.member!==member){identity.current={member};generation.current++;}
 const session=identity.current;
 const [snapshot,setSnapshot]=useState(null);
 const loadData=useCallback(async()=>{
  if(!member||!mounted.current||identity.current!==session)return false;
  const request=++generation.current;
  const active=()=>mounted.current&&identity.current===session&&generation.current===request;
  setSnapshot({session,...EMPTY,loading:true});
  try{
   const {data,failed}=await loadDashboardData(base44,member);
   if(!active())return false;
   setSnapshot({session,...data,rewards:data.rewards.filter(x=>x.active!==false),
    tasks:data.tasks.filter(x=>x.active!==false&&!x.archived&&x.publicly_visible!==false),
    sectionErrors:failed,loading:false});
   return true;
  }catch{
   if(active())setSnapshot({session,...EMPTY,sectionErrors:['dashboard'],loading:false});
   return false;
  }
 },[member,session]);
 useEffect(()=>{mounted.current=true;loadData();return()=>{mounted.current=false;generation.current++;};},[loadData]);
 const owned=!!member&&snapshot?.session===session;
 return {...(owned?snapshot:EMPTY),loading:!!member&&(!owned||snapshot.loading),loadData};
}
