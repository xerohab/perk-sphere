import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {sponsorUrl} from '../../../base44/shared/sponsors.ts';
export default function SponsorSlot({slot}){
 const [advert,setAdvert]=useState(null);
 useEffect(()=>{let current=true;setAdvert(null);
  base44.functions.invoke('getSponsorPlacement',{slot}).then(response=>{
   const row=response.data?.data;if(!row)return;
   try{const target=sponsorUrl(row.target_url);if(current)setAdvert({...row,target_url:target});}catch{/* Never render an unsafe destination. */}
  }).catch(()=>{});return ()=>{current=false;};
 },[slot]);
 if(!advert)return null;
 return <aside aria-label="Sponsored placement" className="my-6 rounded-xl border border-border bg-card p-4">
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Sponsored · {advert.advertiser_name}</span><Link to="/advertise" className="underline">Advertise here</Link></div>
  <a href={advert.target_url} target="_blank" rel="sponsored nofollow noopener noreferrer" referrerPolicy="no-referrer" className="mt-2 block rounded focus-visible:outline focus-visible:outline-2">
   <p className="font-semibold">{advert.headline}</p><p className="mt-1 text-sm text-muted-foreground">{advert.body}</p>
  </a>
 </aside>;
}
