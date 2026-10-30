const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
export function sponsorUrl(value){
 if(!text(value,1000))throw Error('invalid_sponsor_url');
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^(?:\d+\.){3}\d+$/.test(u.hostname)||u.hostname.includes(':')||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname))throw Error('invalid_sponsor_url');
 return u.href;
}
export function validateSponsor(p){
 const keys=['advertiser_name','headline','body','target_url','slot','status','start_date','end_date','pricing_model','booking_price_minor','currency','funding_state','invoice_reference'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!keys.includes(k))||!text(p.advertiser_name,100)||!text(p.headline,100)||!text(p.body,300)||!['home','games'].includes(p.slot)||!['draft','active'].includes(p.status)||p.pricing_model!=='fixed_fee'||!Number.isSafeInteger(p.booking_price_minor)||p.booking_price_minor<0||p.booking_price_minor>100000000||!['GBP','USD'].includes(p.currency)||!['unconfirmed','owner_confirmed'].includes(p.funding_state))throw Error('invalid_sponsor');
 const start=Date.parse(p.start_date),end=Date.parse(p.end_date);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('invalid_sponsor_dates');
 if(p.invoice_reference!=null&&p.invoice_reference!==''&&!text(p.invoice_reference,100))throw Error('invalid_invoice_reference');
 if(p.status==='active'&&(p.funding_state!=='owner_confirmed'||p.booking_price_minor<1||!text(p.invoice_reference,100)))throw Error('confirmed_booking_required');
 return {...p,target_url:sponsorUrl(p.target_url),start_date:new Date(start).toISOString(),end_date:new Date(end).toISOString(),invoice_reference:p.invoice_reference||''};
}
export function publicSponsor(row,now=Date.now()){
 try{
  if(row.status!=='active'||row.funding_state!=='owner_confirmed')return null;
  const fields=['advertiser_name','headline','body','target_url','slot','start_date','end_date','pricing_model','booking_price_minor','currency','funding_state','invoice_reference'];
  const policy=validateSponsor({...Object.fromEntries(fields.map(k=>[k,row[k]])),status:'active'});
  if(Date.parse(policy.start_date)>now||Date.parse(policy.end_date)<=now)return null;
  return {id:row.id,advertiser_name:policy.advertiser_name,headline:policy.headline,body:policy.body,target_url:policy.target_url,slot:policy.slot};
 }catch{return null;}
}
export async function sponsorBody(req,max=8192){
 const reader=req.body?.getReader();if(!reader)throw Error('invalid_request');let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw Error('invalid_request');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid_request');return body;
}
