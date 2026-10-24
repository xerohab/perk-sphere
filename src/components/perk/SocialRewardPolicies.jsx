import React,{useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function SocialRewardPolicies(){
 const [policies,setPolicies]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reason,setReason]=useState('');
 const load=async()=>{const response=await base44.functions.invoke('manageSocialRewardPolicies',{action:'list'});if(response.data?.ok!==true||!Array.isArray(response.data.data))throw Error('Policies unavailable');setPolicies(response.data.data);};
 useEffect(()=>{load().catch(()=>setError('Social reward policies are not available yet.'));},[]);
 const change=(provider,key,value)=>setPolicies(rows=>rows.map(row=>row.provider===provider?{...row,[key]:value}:row));
 const save=async policy=>{
  setBusy(true);setError('');setNotice('');
  try{
   const response=await base44.functions.invoke('manageSocialRewardPolicies',{action:'update',policy:{provider:policy.provider,enabled:policy.enabled,points:Number(policy.points),xp:Number(policy.xp),version:policy.version},reason});
   if(response.data?.ok!==true)throw Error('Save failed');
   await load();setNotice('Policy saved. Rewards still require verified ownership and launch activation.');setReason('');
  }catch(error){setError(error?.response?.status===409?'This policy changed or contains invalid values. Reload before saving.':'Could not save the policy. Please retry.');}
  finally{setBusy(false);}
 };
 return <section className="space-y-3 rounded-lg border p-4">
  <h2 className="font-semibold">Social account linking rewards</h2>
  <p className="text-sm text-muted-foreground">One reward per member and provider, and one per external account. Likes, follows, views and watch time are not eligible.</p>
  {error&&<p role="alert">{error} <Button variant="outline" size="sm" disabled={busy} onClick={()=>load().then(()=>setError('')).catch(()=>setError('Social reward policies are not available yet.'))}>Reload</Button></p>}
  {notice&&<p role="status">{notice}</p>}
  <label className="block text-sm">Reason for change<Input value={reason} maxLength={191} disabled={busy} onChange={event=>setReason(event.target.value)}/></label>
  {policies.map(policy=><div key={policy.provider} className="flex flex-wrap items-end gap-3 rounded border p-3">
   <span className="min-w-20 font-medium">{policy.provider==='youtube'?'YouTube':'X'}</span>
   <label className="text-sm"><input type="checkbox" disabled={busy} checked={policy.enabled} onChange={event=>change(policy.provider,'enabled',event.target.checked)}/> Enabled</label>
   {['points','xp'].map(key=><label key={key} className="text-sm">{key==='xp'?'XP':'Points'}<Input className="w-28" type="number" min="0" max="1000000" step="1" disabled={busy} value={policy[key]} onChange={event=>change(policy.provider,key,event.target.value)}/></label>)}
   <Button disabled={busy||!reason.trim()} onClick={()=>save(policy)}>Save</Button>
  </div>)}
 </section>;
}
