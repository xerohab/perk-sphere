import React,{useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
export default function LaunchBalanceResetPanel(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(){
  setBusy(true);setMessage('Pausing earning and preparing the existing wallet balances…');
  try{
   await base44.functions.invoke('prepareWalletOpening',{action:'freeze'});
   let offset=0,done=false,verifiedAt=null;const members=[];
   while(!done){const {data}=await base44.functions.invoke('prepareWalletOpening',{action:'export',offset});if(data.legacy_writers_frozen!==true||!Array.isArray(data.members)||data.next_offset!==offset+25||typeof data.done!=='boolean'||!Number.isFinite(Date.parse(data.verified_at)))throw Error('Invalid opening export');members.push(...data.members);if(members.length>100000)throw Error('Opening export exceeds the supported population');offset=data.next_offset;done=data.done;verifiedAt=data.verified_at;}
   if(!members.length)throw Error('No member accounts were exported');
   const manifest={version:1,run_reference:'perksphere-preserved-opening-20261024',app_reference:'6ac4c3e3ea28af5826e4b364',legacy_writers_frozen:true,verified_at:verifiedAt,members};
   const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='perksphere-wallet-opening.json';link.click();URL.revokeObjectURL(url);
   setMessage('Existing balances exported for '+members.length+' members. Earning remains paused for wallet cutover. All Points and XP balances are preserved.');
  }catch(error){setMessage(error?.response?.data?.error||'Export interrupted. Balances are preserved. Earning remains paused until resumed.');}
  finally{setBusy(false);}
 }
 async function resume(){setBusy(true);try{await base44.functions.invoke('prepareWalletOpening',{action:'resume'});setMessage('Legacy earning resumed. Export a fresh snapshot before wallet cutover.');}catch(error){setMessage(error?.response?.data?.error||'Could not resume earning.');}finally{setBusy(false);}}
 return <section className="mb-6 rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Prepare existing wallet balances</h2><p className="text-sm text-muted-foreground">Export current Points and XP for wallet cutover. Earning is paused while the opening snapshot is prepared; current balances are preserved.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={run}>{busy?'Preparing…':'Export existing wallet balances'}</Button><Button variant="outline" disabled={busy} onClick={resume}>Resume earning before cutover</Button></div>{message&&<p role="status" className="text-sm">{message}</p>}</section>;
}
