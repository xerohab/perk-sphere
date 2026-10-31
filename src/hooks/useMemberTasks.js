import {useState,useRef,useEffect,useCallback} from 'react';
import {base44} from '@/api/base44Client';
const EMPTY={tasks:[],progress:[],loadError:'',loading:true};
export function useMemberTasks(userId,toast,checkUserAuth){
 const member=userId?String(userId):null,identity=useRef({member}),generation=useRef(0),mounted=useRef(true),action=useRef(null);
 if(identity.current.member!==member){identity.current={member};generation.current++;action.current=null;}
 const session=identity.current;
 const [snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(null);
 const current=()=>mounted.current&&identity.current===session;
 const load=useCallback(async silent=>{
  if(!member||!mounted.current||identity.current!==session)return false;
  const request=++generation.current,active=()=>mounted.current&&identity.current===session&&generation.current===request;
  setSnapshot(previous=>({...((previous?.session===session)?previous:EMPTY),session,loadError:'',loading:!silent}));
  try{
   const [tasks,progress]=await Promise.all([base44.entities.Task.list('-created_date',200),base44.entities.TaskProgress.filter({user_id:member})]);
   if(!Array.isArray(tasks)||!Array.isArray(progress))throw Error('INVALID_TASKS');
   if(!active())return false;
   setSnapshot({session,tasks:tasks.filter(x=>x.active!==false&&!x.archived&&x.publicly_visible!==false),progress,loadError:'',loading:false});
   return true;
  }catch{
   if(active())setSnapshot({session,...EMPTY,loading:false,loadError:'Tasks are temporarily unavailable. Please retry.'});
   return false;
  }
 },[member,session]);
 useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;generation.current++;action.current=null;};},[load]);
 const acquire=task=>{
  if(!member||!current()||action.current)return null;
  const token={session,taskId:task.id};action.current=token;setBusy(token);
  return {active:()=>current()&&action.current===token,release:()=>{if(action.current===token){action.current=null;setBusy(null);}}};
 };
 const handleStart=async task=>{
  const lock=acquire(task);if(!lock)return;
  try{
   const response=await base44.functions.invoke('startTask',{taskId:task.id}),data=response?.data;
   if(!lock.active())return;
   if(data?.ok!==true||data.progress?.task_id!==task.id||data.progress?.user_id!==member||data.progress?.status!=='in_progress')throw Error('UNCONFIRMED_START');
   toast({title:'Task started',description:'Your task is now in progress.'});
   await load(true);
  }catch{if(lock.active())toast({title:'Start could not be confirmed',description:'Refresh tasks before retrying. Partner tasks start automatically after verified activity.',variant:'destructive'});}
  finally{lock.release();}
 };
 const handleComplete=async task=>{
  const lock=acquire(task);if(!lock)return;
  try{
   const response=await base44.functions.invoke('completeTask',{taskId:task.id}),data=response?.data;
   if(!lock.active())return;
   if(data?.ok!==true)throw Error('UNCONFIRMED_COMPLETION');
   if(data.already_completed===true)toast({title:'Already completed'});
   else {
    if(!Number.isSafeInteger(data.points_issued)||data.points_issued<0||!Number.isSafeInteger(data.xp_issued)||data.xp_issued<0)throw Error('INVALID_RECEIPT');
    toast({title:'Task completed',description:data.points_issued||data.xp_issued?'Earned '+data.points_issued+' Points and '+data.xp_issued+' XP.':'Completion confirmed.'});
   }
   // A confirmed completion remains confirmed when refreshing the view fails.
   const loaded=await load(true);
   if(lock.active()&&!loaded)toast({title:'Completion confirmed',description:'Refresh tasks to update the displayed progress.'});
   if(lock.active())try{await checkUserAuth?.();}catch{if(lock.active())toast({title:'Completion confirmed',description:'Refresh your profile to update the displayed totals.'});}
  }catch{if(lock.active())toast({title:'Completion could not be confirmed',description:'Refresh tasks before retrying. Partner tasks complete automatically after independent verification.',variant:'destructive'});}
  finally{lock.release();}
 };
 const owned=!!member&&snapshot?.session===session;
 return {...(owned?snapshot:EMPTY),loading:!!member&&(!owned||snapshot.loading),load,handleStart,handleComplete,actionTaskId:busy?.session===session?busy.taskId:null};
}
