import React,{useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {Button} from '@/components/ui/button';
export default function Advertise(){
 const {user}=useAuth(),lock=useRef(false);
 const [form,setForm]=useState({advertiser_name:'',website_url:'',message:''}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const change=event=>setForm({...form,[event.target.name]:event.target.value});
 async function submit(event){event.preventDefault();if(lock.current||!user?.id)return;lock.current=true;setBusy(true);setMessage('');
  try{const result=await base44.functions.invoke('submitSponsorInquiry',form);if(result.data?.ok!==true)throw Error();setMessage('Your enquiry has been saved for the Perk Sphere team to review.');setForm({advertiser_name:'',website_url:'',message:''});}
  catch{setMessage('Your enquiry could not be saved. Check the details and try again. You can have up to three open enquiries.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
  <h1 className="text-3xl font-bold">Advertise on Perk Sphere</h1>
  <p className="text-muted-foreground">Reach visitors with clearly labelled sponsor placements on our homepage and Games page. We offer direct bookings with agreed dates and a fixed fee.</p>
  <div className="rounded-xl border bg-card p-5 text-sm space-y-2"><p>Every booking is reviewed before publication. Tell us about your business, proposed campaign dates and budget.</p><p>Submitting an enquiry does not take payment or reserve a placement. We agree the booking and payment arrangements separately.</p><p>Visitors do not earn Points or XP for viewing or clicking sponsor adverts. Placements do not include third-party tracking scripts.</p></div>
  {!user?<p><Link to="/login" className="underline">Sign in</Link> or <Link to="/register" className="underline">create an account</Link> to send an advertising enquiry.</p>:<form onSubmit={submit} className="space-y-4">
   <label className="block text-sm">Business or advertiser name<input required maxLength={100} name="advertiser_name" value={form.advertiser_name} onChange={change} className="mt-1 block w-full rounded border bg-background p-3"/></label>
   <label className="block text-sm">Website (HTTPS)<input required type="url" maxLength={1000} name="website_url" value={form.website_url} onChange={change} placeholder="https://example.com" className="mt-1 block w-full rounded border bg-background p-3"/></label>
   <label className="block text-sm">Campaign details<textarea required minLength={20} maxLength={2000} name="message" value={form.message} onChange={change} rows={5} className="mt-1 block w-full rounded border bg-background p-3"/></label>
   <p className="text-xs text-muted-foreground">The team will receive the contact email from your Perk Sphere account.</p><Button disabled={busy} type="submit">{busy?'Saving…':'Send enquiry'}</Button>
  </form>}
  {message&&<p role="status" className="rounded border p-4 text-sm">{message}</p>}
 </div>;
}
