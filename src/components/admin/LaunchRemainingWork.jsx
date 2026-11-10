import React from 'react';
import {Link} from 'react-router-dom';

const work=[
 {id:'core',title:'Core Points and XP',status:'Published · real-member acceptance pending',remaining:'Complete a genuine new-member registration, zero-balance wallet, game and daily-point claims, duplicate retries, partner/watch rewards, mobile checks and account switching. Confirm every expected credit in wallet history.',link:'/games',label:'Open games'},
 {id:'connections',title:'Providers and browser extension',status:'Integration code present · full coverage not signed off',remaining:'Confirm missing provider settings privately, test ordinary-member YouTube/X connections and browser pairing/activity tracking, and verify each promised partner event end to end. Account ownership alone does not verify viewing, likes or follows.',link:'/connected-services',label:'Open connected services'},
 {id:'worker',title:'Payment notification worker',status:'Installed and tested while disabled',remaining:'Supply the private worker configuration, register and verify the genuine source, provision its dedicated database permissions, and complete provider-signature/resource, alerting and recovery acceptance before activation. Source administration and read-only queue inspection are already live.',link:'/admin/gift-sources',label:'Open source administration (Super Admin)'},
 {id:'gifts',title:'Gift-card checkout and delivery',status:'Backend components prepared · production flow incomplete',remaining:'Connect trusted offers/pricing and funding to verified payment, fulfilment, secure voucher delivery and reconciliation. Complete real provider tests, including uncertain responses, refunds and disputes. A provider key alone does not finish this flow.'},
 {id:'cash',title:'Cash, withdrawals, Points top-ups and FX',status:'Incomplete / paused',remaining:'Finish the production flows, select and review rates and funding policies, connect the relevant providers, and verify exact wallet receipts, duplicate handling and recovery. Administration controls do not establish funded or settled payments.'},
 {id:'subscriptions',title:'Front Row paid subscriptions',status:'Prepared changes · live callback/access cutover outstanding',remaining:'Complete verified callback cutover, legacy ownership/entitlement migration, protected media and uncertain-write recovery. Then test genuine purchase, renewal, cancellation, refund and duplicate-event lifecycles.'},
 {id:'rewards',title:'Separately paused reward features',status:'Require their own reviewed activation and acceptance',remaining:'Review policy/content and activate only the intended social-link rewards, rewarded quizzes and XP conversion. Verify first awards, failed attempts where applicable, duplicate-zero outcomes and original wallet history.',link:'/admin/quizzes',label:'Open quiz policy administration'}
];

export default function LaunchRemainingWork(){
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="remaining-launch-work">
  <div><h2 id="remaining-launch-work" className="font-semibold">Remaining launch work</h2><p className="mt-2 text-sm text-muted-foreground">Engineering checklist updated 10 November 2026. The core site is published; the full launch still needs implementation, private setup and genuine member/provider acceptance.</p></div>
  <div className="grid gap-3 lg:grid-cols-2">{work.map(item=><article key={item.id} className="space-y-2 rounded-lg border p-4">
   <h3 className="font-medium">{item.title}</h3>
   <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{item.status}</p>
   <p className="text-sm">{item.remaining}</p>
   {item.link&&<Link className="inline-block text-sm underline" to={item.link}>{item.label}</Link>}
  </article>)}</div>
 </section>;
}
