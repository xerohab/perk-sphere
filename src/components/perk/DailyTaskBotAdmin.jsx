import React, {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function DailyTaskBotAdmin(){
 const [source,setSource]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const invoke=async(action,extra={})=>{const res=await base44.functions.invoke('manageDailyTaskBot',{action,...extra});const data=res.data||res;if(data.error)throw Error(data.error);return data;};
 useEffect(()=>{let alive=true;invoke('status').then(data=>{if(alive)setSource(data.source);}).catch(e=>{if(alive)setMessage(e?.response?.data?.error||e.message);});return()=>{alive=false;};},[]);
 const run=async(action)=>{setBusy(true);setMessage('');try{const data=await invoke(action,action==='save'?{source}:{});if(action==='preview')setPreview(data);else{setSource(data.source);setPreview(null);setMessage('Source controls saved.');}}catch(e){setMessage(e?.response?.data?.error||e.message);}finally{setBusy(false);}};
 return <section className="rounded-xl border p-4 space-y-3 mb-6" aria-label="Daily task bot">
  <h2 className="font-semibold">Daily task bot</h2>
  <p className="text-sm text-muted-foreground">Scans XeroStreams at 09:00 London time. Prepares private, zero-reward drafts from recent native uploads. Review rewards, verified duration, player binding and worker registration before publishing. Other sites and account adapters are not connected yet.</p>
  {source&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <label className="text-sm">Source<select className="block w-full rounded-md border bg-background p-2" value={source.enabled?'enabled':'paused'} onChange={e=>setSource({...source,enabled:e.target.value==='enabled'})}><option value="enabled">XeroStreams enabled</option><option value="paused">XeroStreams paused</option></select></label>
   <label className="text-sm">Watch rule<select className="block w-full rounded-md border bg-background p-2" value={source.mode} onChange={e=>setSource({...source,mode:e.target.value})}><option value="partial">Watch part</option><option value="full_episode">Full episode</option><option value="alternate">Alternate by day</option></select></label>
   <label className="text-sm">Partial watch (seconds)<Input type="number" min={60} max={1800} value={source.partial_seconds} onChange={e=>setSource({...source,partial_seconds:Number(e.target.value)})}/></label>
   <label className="text-sm">Maximum drafts each day<Input type="number" min={1} max={5} value={source.daily_max} onChange={e=>setSource({...source,daily_max:Number(e.target.value)})}/></label>
  </div><div className="flex gap-2"><Button disabled={busy} onClick={()=>run('save')}>Save controls</Button><Button variant="outline" disabled={busy} onClick={()=>run('preview')}>Preview saved source</Button></div><p className="text-xs text-muted-foreground">Only Super Admins can save controls. Preview reads the saved configuration. Each content item is drafted at most once; changing the rule does not issue another reward task.</p></>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {preview&&<div className="text-sm space-y-2"><p>{preview.candidates.length} recent candidates. Up to {preview.source.daily_max} new drafts per day; previously drafted content is skipped by the scheduled runner.</p>{preview.candidates.slice(0,10).map(c=><div key={c.generation_key} className="border-t pt-2"><span className="font-medium">{c.title}</span> — {c.mode==='full_episode'?'Full episode':`${c.required_seconds} seconds`}{!c.duration&&' · Duration verification needed'}<p className="text-xs text-muted-foreground">{c.review_note}</p></div>)}</div>}
 </section>;
}
