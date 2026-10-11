import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import PageHeader from '@/components/perk/PageHeader';
import {Button} from '@/components/ui/button';
export default function AdminGames(){
 const [policies,setPolicies]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 async function load(){
  try{const r=await base44.functions.invoke('manageGames',{action:'list'});if(!Array.isArray(r.data?.data))throw new Error();setPolicies(r.data.data);}
  catch{setError('Game policies are unavailable. The Linux game schema must be installed before configuration.');}
 }
 useEffect(()=>{load();},[]);
 function change(index,field,value){setPolicies(old=>old.map((p,i)=>i===index?{...p,[field]:value}:p));}
 async function save(p){
  setBusy(true);setError('');setNotice('');
  try{
   const policy={game_reference:p.game_reference,enabled:p.enabled,required_seconds:Number(p.required_seconds),points:Number(p.points),xp:Number(p.xp),version:Number(p.version)};
   const r=await base44.functions.invoke('manageGames',{action:'update',policy});
   if(r.data?.error || !r.data?.data?.updated)throw new Error();
   await load();setNotice('Policy saved. Changed settings invalidate older sessions. The Linux game feature must also be enabled before rewards are available.');
  }catch{setError('Could not save. Check values or reload if another administrator changed the policy.');}
  finally{setBusy(false);}
 }
 return <div className="space-y-6">
  <PageHeader title="Game rewards" description="Set eligible play time and rewards for games hosted on Perk Sphere." />
  <p className="text-sm text-muted-foreground">One reward per member per game per UTC day. Only successful active rounds count. Enable rewards only after launch approval.</p>
  {error && <p role="alert" className="text-destructive">{error}</p>}
  {notice && <p role="status">{notice}</p>}
  <Button disabled={busy} onClick={load}>Reload policies</Button>
  <div className="grid gap-4 md:grid-cols-3">{policies.map((p,index)=><form key={p.game_reference} className="rounded-xl border bg-card p-5 space-y-4" onSubmit={e=>{e.preventDefault();save(p);}}>
   <h2 className="font-semibold">{p.title}</h2>
   {[['required_seconds','Play time (seconds)',60,3600],['points','Points',0,1000000],['xp','XP',0,1000000]].map(([field,label,min,max])=><label key={field} className="block text-sm">{label}
    <input className="mt-1 w-full rounded-md border bg-background p-2" type="number" required min={min} max={max} step="1" value={p[field]} onChange={e=>change(index,field,e.target.value)} disabled={busy} />
   </label>)}
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.enabled} onChange={e=>change(index,'enabled',e.target.checked)} disabled={busy} />Rewards enabled</label>
   <Button type="submit" disabled={busy}>Save policy</Button>
  </form>)}</div>
 </div>;
}
