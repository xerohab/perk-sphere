import React,{useCallback,useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import PageHeader from '@/components/perk/PageHeader';
import {Button} from '@/components/ui/button';
const initial={advertiser_name:'',headline:'',body:'',target_url:'',slot:'home',status:'draft',start_date:'',end_date:'',pricing_model:'fixed_fee',price:'0.00',currency:'GBP',funding_state:'unconfirmed',invoice_reference:''};
export default function AdminSponsors(){
 const [data,setData]=useState({placements:[],inquiries:[]}),[form,setForm]=useState(initial),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const lock=useRef(false),generation=useRef(0);
 const load=useCallback(async()=>{const current=++generation.current;setLoading(true);try{const response=await base44.functions.invoke('manageSponsors',{action:'list'});if(response.data?.ok!==true)throw Error();if(current===generation.current)setData(response.data);}catch{if(current===generation.current)setError('Could not load sponsorships. Campaign management permission is required.');}finally{if(current===generation.current)setLoading(false);}},[]);
 useEffect(()=>{load();return ()=>{generation.current++;};},[load]);
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 async function run(body){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const response=await base44.functions.invoke('manageSponsors',body);if(response.data?.ok!==true)throw Error();await load();return true;}catch{setError('The change could not be confirmed. Reload before retrying to avoid a duplicate booking.');return false;}finally{lock.current=false;setBusy(false);}}
 async function create(event){event.preventDefault();
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(form.price)){setError('Enter a booking price with up to two decimal places.');return;}
  const [whole,fraction='']=form.price.split('.'),booking_price_minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  const {price:_price,...fields}=form;const start=new Date(form.start_date),end=new Date(form.end_date);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())){setError('Choose valid start and end dates.');return;}
  const success=await run({action:'create',reason,placement:{...fields,booking_price_minor,start_date:start.toISOString(),end_date:end.toISOString()}});
  if(success){setForm(initial);setReason('');}
 }
 return <div className="space-y-6">
  <PageHeader title="Sponsorships" description="Direct fixed-fee advertising bookings and advertiser enquiries"/>
  <div className="rounded-xl border bg-card p-4 text-sm space-y-2"><p>Booking amounts are agreed prices, not revenue received. Payment confirmation below is your manual declaration; this page does not verify a provider payment or collect money.</p><p>Active placements require a positive price, your payment confirmation and a booking/invoice reference. No member rewards or automated impression billing are attached to adverts.</p></div>
  {error&&<p role="alert" className="rounded border p-4 text-sm">{error}</p>}<Button variant="outline" disabled={loading||busy} onClick={load}>Reload sponsorships</Button>
  <form onSubmit={create} className="rounded-xl border bg-card p-5 space-y-4">
   <h2 className="text-lg font-semibold">New booking</h2>
   {['advertiser_name','headline','body','target_url','invoice_reference'].map(name=><label key={name} className="block text-sm">{({advertiser_name:'Advertiser',headline:'Advert headline',body:'Advert text',target_url:'Destination URL (HTTPS)',invoice_reference:'Booking / invoice reference'})[name]}<input required={name!=='invoice_reference'} name={name} maxLength={name==='body'?300:name==='target_url'?1000:100} value={form[name]} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"/></label>)}
   <div className="grid gap-4 sm:grid-cols-2">{['start_date','end_date'].map(name=><label key={name} className="text-sm">{name==='start_date'?'Start':'End'} (your local time)<input required type="datetime-local" name={name} value={form[name]} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"/></label>)}</div>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm">Placement<select name="slot" value={form.slot} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"><option value="home">Homepage</option><option value="games">Games</option></select></label>
    <label className="text-sm">Booking price<input required name="price" inputMode="decimal" value={form.price} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"/></label>
    <label className="text-sm">Currency<select name="currency" value={form.currency} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"><option>GBP</option><option>USD</option></select></label>
    <label className="text-sm">Publication<select name="status" value={form.status} onChange={change} className="mt-1 block w-full rounded border bg-background p-2"><option value="draft">Draft</option><option value="active">Activate after review</option></select></label>
   </div>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.funding_state==='owner_confirmed'} onChange={e=>setForm({...form,funding_state:e.target.checked?'owner_confirmed':'unconfirmed'})}/>I have independently confirmed payment for this booking.</label>
   <label className="block text-sm">Reason for audit<input required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2"/></label>
   <Button type="submit" disabled={busy||loading}>{busy?'Saving…':'Create booking'}</Button>
  </form>
  <section className="space-y-3"><h2 className="text-lg font-semibold">Latest bookings</h2>{loading?<p>Loading…</p>:data.placements.length===0?<p>No bookings yet.</p>:data.placements.map(row=><article key={row.id} className="rounded-xl border p-4"><p className="font-semibold">{row.headline}</p><p className="text-sm">{row.advertiser_name} · {row.slot} · {row.status} · {row.currency} {(Number(row.booking_price_minor)/100).toFixed(2)} agreed booking price</p><p className="text-xs text-muted-foreground">Payment declaration: {row.funding_state} · {row.invoice_reference||'No reference'}</p>{row.status!=='paused'&&<Button variant="outline" className="mt-2" disabled={busy} onClick={()=>run({action:'pause',id:row.id})}>Pause placement</Button>}</article>)}</section>
  <section className="space-y-3"><h2 className="text-lg font-semibold">Advertiser enquiries</h2>{!loading&&data.inquiries.length===0&&<p>No enquiries yet.</p>}{data.inquiries.map(row=><article key={row.id} className="rounded-xl border p-4 space-y-2"><p className="font-semibold">{row.advertiser_name} · {row.status}</p><p className="text-sm">{row.contact_email}</p><p className="text-sm break-all">{row.website_url}</p><p className="whitespace-pre-wrap text-sm">{row.message}</p>{row.status==='new'&&<Button variant="outline" disabled={busy} onClick={()=>run({action:'closeInquiry',id:row.id})}>Mark reviewed / closed</Button>}</article>)}</section>
 </div>;
}
