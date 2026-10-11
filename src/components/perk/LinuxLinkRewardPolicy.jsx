import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function LinuxLinkRewardPolicy({partners=[]}) {
 const [scope,setScope]=useState('global'),[rows,setRows]=useState([]),[draft,setDraft]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const load=async()=>{const {data}=await base44.functions.invoke('partnerRewardPolicy',{action:'list'});setRows(data.data||[]);setReady(true);};
 useEffect(()=>{load().catch(()=>setMessage('Linux reward policy administration is awaiting API deployment.'));},[]);
 const existing=rows.find(row=>row.scope_reference===scope&&row.event_type==='account_linked');
 const value=draft||{enabled:!!Number(existing?.enabled||0),points:existing?.points??25,xp:existing?.xp??10};
 async function save(){
 setBusy(true);setMessage('');
 try{
 await base44.functions.invoke('partnerRewardPolicy',{action:'update',expected_version:existing?.version||0,reason:'Small launch account-link reward configuration',policy:{partner_uuid:scope==='global'?null:scope,event_type:'account_linked',policy_id:existing?.policy_id||'launch-link:'+scope,enabled:value.enabled,points:Number(value.points),xp:Number(value.xp),daily_limit:1,cooldown_seconds:0,min_watch_seconds:0}});
 await load();setDraft(null);setMessage('Linux account-link policy saved. Rewards also require the launch flags and migrated wallets.');
 }catch(error){setMessage(error?.response?.data?.code||error?.response?.data?.error||'Could not save Linux policy.');}finally{setBusy(false);}
 }
 return <section className="rounded-lg border p-4 space-y-3">
 <h2 className="font-semibold">Linux account-link rewards</h2>
 <p className="text-sm text-muted-foreground">These rules control the verified link reward engine. Each member can earn once per partner. New registration, streaming and payment rewards require their own verified sources.</p>
 <label className="block text-sm">Scope<select className="block rounded border bg-background p-2" value={scope} onChange={e=>{setScope(e.target.value);setDraft(null);}}><option value="global">Global default</option>{partners.filter(p=>p.linux_api_partner_id).map(p=><option key={p.id} value={p.linux_api_partner_id}>{p.name}</option>)}</select></label>
 <div className="flex flex-wrap gap-4 items-end">
 <label className="text-sm">Points<Input type="number" min="0" max="1000000" value={value.points} onChange={e=>setDraft({...value,points:e.target.value})}/></label>
 <label className="text-sm">XP<Input type="number" min="0" max="1000000" value={value.xp} onChange={e=>setDraft({...value,xp:e.target.value})}/></label>
 <label className="text-sm flex gap-2"><input type="checkbox" checked={value.enabled} onChange={e=>setDraft({...value,enabled:e.target.checked})}/>Enable this policy</label>
 <Button disabled={busy||!ready} onClick={save}>{busy?'Saving…':'Save Linux rule'}</Button></div>
 <p className="text-sm text-muted-foreground">{existing?'Version '+existing.version:scope==='global'?'No global rule saved.':'No override saved; uses the global rule.'}</p>
 {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
