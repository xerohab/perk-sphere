import './runtime-mocks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSponsor,sponsorUrl,publicSponsor} from '../base44/shared/sponsors.ts';
import manage from '../base44/functions/manageSponsors/entry.ts';
import placement from '../base44/functions/getSponsorPlacement/entry.ts';
import inquire from '../base44/functions/submitSponsorInquiry/entry.ts';
const post=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
const policy={advertiser_name:'Fixture sponsor',headline:'Fixture headline',body:'A clearly labelled sponsor placement.',target_url:'https://example.com/offer',slot:'home',status:'active',start_date:'2026-01-01T00:00:00Z',end_date:'2027-01-01T00:00:00Z',pricing_model:'fixed_fee',booking_price_minor:1000,currency:'GBP',funding_state:'owner_confirmed',invoice_reference:'SYNTHETIC-INVOICE'};
function fixture({role='super_admin',auditFailure=false}={}){
 const writes=[],rows=[];globalThis.__testClient={auth:{me:async()=>({id:'MEMBER',email:'fixture@example.invalid',role:'admin'})},asServiceRole:{entities:{
  StaffMember:{filter:async()=>[{active:true,staff_role:role}]},
  AuditLog:{create:async row=>{writes.push(['audit',row]);if(auditFailure)throw Error('private fixture');}},
  SponsorPlacement:{create:async row=>{const value={id:'placement',...row};rows.push(value);writes.push(['create',row]);return value;},update:async(id,row)=>{writes.push(['update',row]);Object.assign(rows[0],row);},filter:async()=>[{id:'placement',...policy}],list:async()=>rows,get:async()=>rows[0]},
  SponsorInquiry:{filter:async()=>[],create:async row=>{writes.push(['inquiry',row]);return {id:'inquiry'};},list:async()=>[]}
 }}};
 return {writes,rows};
}
test('sponsor destinations reject executable URLs, credentials, local addresses and non-HTTPS',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://localhost','https://foo.internal','https://example.com:8443'])assert.throws(()=>sponsorUrl(url));
 assert.equal(sponsorUrl('https://example.com/path'),'https://example.com/path');
});
test('active placements require a positive agreed price and explicit owner confirmation/reference',()=>{
 assert.equal(validateSponsor(policy).currency,'GBP');
 for(const change of [{funding_state:'unconfirmed'},{booking_price_minor:0},{booking_price_minor:1.2},{invoice_reference:''},{end_date:policy.start_date},{target_url:'javascript:bad'},{pricing_model:'cpm'},{secret:'forged'}])assert.throws(()=>validateSponsor({...policy,...change}));
});
test('public placement omits internal money/contact details and excludes unavailable campaigns',async()=>{
 fixture();const response=await placement(post({slot:'home'}));assert.equal(response.status,200);const raw=await response.text();assert.doesNotMatch(raw,/invoice|funding|price|currency|created_by/);assert.equal(JSON.parse(raw).data.headline,policy.headline);
 for(const change of [{status:'draft'},{status:'paused'},{funding_state:'unconfirmed'},{end_date:'2020-01-01'},{start_date:'2099-01-01'},{target_url:'javascript:bad'}])assert.equal(publicSponsor({...policy,...change}),null);
 assert.equal((await placement(post({slot:'home',user_id:'OTHER'}))).status,400);
});
test('only staff with campaign management can create sponsor bookings',async()=>{
 const f=fixture({role:'analyst'});assert.equal((await manage(post({action:'create',placement:policy,reason:'Fixture setup'}))).status,403);assert.equal(f.writes.length,0);
});
test('audit failure leaves the booking in draft and never publishes an advert',async()=>{
 const f=fixture({auditFailure:true});const response=await manage(post({action:'create',placement:policy,reason:'Fixture setup'}));assert.equal(response.status,503);assert.equal(f.rows[0].status,'draft');assert.equal(f.writes.some(([kind])=>kind==='update'),false);assert.doesNotMatch(await response.text(),/private fixture/);
});
test('approved booking records the authenticated audit actor before activation',async()=>{
 const f=fixture();const response=await manage(post({action:'create',placement:policy,reason:'Fixture setup'}));assert.equal(response.status,200);assert.deepEqual(f.writes.map(([kind])=>kind),['create','audit','update']);assert.equal(f.writes[1][1].admin_id,'MEMBER');assert.equal(f.rows[0].status,'active');
});
test('advertiser enquiry identity and contact email come from authentication, never the browser',async()=>{
 const f=fixture();const body={advertiser_name:'Fixture business',website_url:'https://example.com',message:'We would like to discuss a sponsor placement.'};
 assert.equal((await inquire(post({...body,contact_email:'other@example.com'}))).status,400);assert.equal((await inquire(post(body))).status,200);
 const saved=f.writes.find(([kind])=>kind==='inquiry')[1];assert.equal(saved.user_id,'MEMBER');assert.equal(saved.contact_email,'fixture@example.invalid');assert.equal(saved.status,'new');
});
test('enquiries require an eligible account and limit unresolved submissions',async()=>{
 fixture();globalThis.__testClient.auth.me=async()=>null;assert.equal((await inquire(post({}))).status,401);
 fixture();globalThis.__testClient.auth.me=async()=>({id:'MEMBER',account_status:'disabled'});assert.equal((await inquire(post({}))).status,403);
 const f=fixture();globalThis.__testClient.asServiceRole.entities.SponsorInquiry.filter=async()=>[{},{},{}];
 assert.equal((await inquire(post({advertiser_name:'Fixture',website_url:'https://example.com',message:'A sufficiently detailed test campaign enquiry.'}))).status,429);assert.equal(f.writes.length,0);
});
test('sponsor records are private and all direct client writes are service-only',async()=>{
 for(const name of ['SponsorPlacement','SponsorInquiry']){const schema=JSON.parse(await readFile(new URL('../base44/entities/'+name+'.jsonc',import.meta.url),'utf8'));for(const action of ['create','update','delete'])assert.deepEqual(schema.rls[action],{user_condition:{role:'service_only'}});assert.deepEqual(schema.rls.read,{user_condition:{role:'admin'}});}
});
test.after(()=>delete globalThis.__testClient);
